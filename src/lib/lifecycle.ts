import { and, eq, gt, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "./db";
import { appSettings, appointments, events, orders, sessions, tenants, users } from "@/db/schema";
import { addDays } from "./time";
import { sendEmail } from "./email";
import { publicUrl } from "./config";
import { pruneLimits } from "./ratelimit";

export const GRACE_DAYS = 14;

const globalForLifecycle = globalThis as unknown as { __vitrioLastRun?: number };
const MIN_INTERVAL_MS = 60_000;

export type LifecycleReport = {
  ranAt: string;
  frozen: number;
  deleted: number;
  warnings: number;
  expiredAppointments: number;
  expiredOrders: number;
};

/**
 * Ejecucion perezosa: como maximo una vez por minuto por instancia.
 * Se llama desde getSession y desde el catalogo publico, ademas del cron externo.
 */
export async function maybeRunLifecycle(): Promise<void> {
  // Sin base de datos configurada no hay nada que hacer (build estático, CLI, tests).
  if (!process.env.DATABASE_URL) return;
  const now = Date.now();
  if (globalForLifecycle.__vitrioLastRun && now - globalForLifecycle.__vitrioLastRun < MIN_INTERVAL_MS) {
    return;
  }
  globalForLifecycle.__vitrioLastRun = now;
  try {
    await runLifecycle();
  } catch (err) {
    console.error("[lifecycle] error", err);
  }
}

async function alreadyWarned(tenantId: string, type: string): Promise<boolean> {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        eq(events.type, type),
        // un solo aviso por ventana de 3 dias
        gt(events.createdAt, new Date(Date.now() - 3 * 86_400_000)),
      ),
    )
    .limit(500);
  return rows.length > 0;
}

/** Congela trials vencidos, avisa, borra (RGPD) y limpia caducados. */
export async function runLifecycle(now = new Date()): Promise<LifecycleReport> {
  const report: LifecycleReport = {
    ranAt: now.toISOString(),
    frozen: 0,
    deleted: 0,
    warnings: 0,
    expiredAppointments: 0,
    expiredOrders: 0,
  };

  // 1. Avisos previos al vencimiento del trial (3 dias y 1 dia)
  const trials = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.status, "trial"), isNotNull(tenants.trialEndsAt)));

  for (const t of trials) {
    if (!t.trialEndsAt) continue;
    const msLeft = t.trialEndsAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / 86_400_000);
    const marker = daysLeft <= 1 ? "trial_warning_1d" : daysLeft <= 3 ? "trial_warning_3d" : null;
    if (!marker || msLeft < 0) continue;
    if (await alreadyWarned(t.id, marker)) continue;
    await db.insert(events).values({ tenantId: t.id, type: marker, meta: { daysLeft } });
    if (t.ownerEmail) {
      await sendEmail(
        t.ownerEmail,
        daysLeft <= 1 ? "Tu prueba de Vitrio termina mañana" : "Tu prueba de Vitrio termina en 3 días",
        `Hola ${t.ownerName ?? ""}:\n\nLa prueba gratuita de ${t.name} termina el ${t.trialEndsAt.toISOString().slice(0, 10)}.\n\n` +
          `Para seguir con el catálogo, las reservas y los encargos, dile a tu asesor que active el plan desde Vitrio.\n\n` +
          `Tu catálogo público: ${publicUrl(`/c/${t.slug}`)}\n`,
      );
    }
    report.warnings += 1;
  }

  // 2. Trial vencido -> congelado 14 dias
  const toFreeze = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.status, "trial"), isNotNull(tenants.trialEndsAt), lt(tenants.trialEndsAt, now)));

  for (const t of toFreeze) {
    const deleteAt = addDays(now, GRACE_DAYS);
    await db
      .update(tenants)
      .set({ status: "frozen", frozenAt: now, deleteAt, updatedAt: now })
      .where(eq(tenants.id, t.id));
    await db.insert(events).values({ tenantId: t.id, type: "trial_frozen", meta: { deleteAt } });
    if (t.ownerEmail) {
      await sendEmail(
        t.ownerEmail,
        "Tu cuenta de Vitrio está congelada",
        `La prueba de ${t.name} ha terminado y la cuenta queda congelada ${GRACE_DAYS} días.\n\n` +
          `El catálogo público deja de mostrarse. Tus datos se conservan hasta el ${deleteAt.toISOString().slice(0, 10)}; ` +
          `después se eliminan de forma definitiva (RGPD).\n\nSi quieres seguir, pide a tu asesor que active el plan.\n`,
      );
    }
    report.frozen += 1;
  }

  // 3. Congelado sin pago -> borrado RGPD y anonimizado
  const toDelete = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.status, "frozen"), isNotNull(tenants.deleteAt), lt(tenants.deleteAt, now)));

  for (const t of toDelete) {
    await deleteTenantData(t.id);
    await db
      .update(tenants)
      .set({
        status: "deleted",
        deletedAt: now,
        anonymizedAt: now,
        name: "Comercio eliminado",
        slug: `borrado-${t.id.slice(0, 8)}`,
        ownerEmail: null,
        ownerName: null,
        phone: null,
        whatsapp: null,
        address: null,
        city: null,
        logoData: null,
        policyText: null,
        activationRequested: false,
        bookingsEnabled: false,
        ordersEnabled: false,
        updatedAt: now,
      })
      .where(eq(tenants.id, t.id));
    await db.delete(users).where(eq(users.tenantId, t.id));
    await db.insert(events).values({ tenantId: null, type: "tenant_deleted", meta: { id: t.id } });
    if (t.ownerEmail) {
      await sendEmail(
        t.ownerEmail,
        "Tus datos de Vitrio se han eliminado",
        `La cuenta de ${t.name} se ha eliminado y sus datos personales han sido borrados conforme al RGPD.\n`,
      );
    }
    report.deleted += 1;
  }

  // 4. Reservas pendientes de pago que caducaron (retencion de franja)
  const staleAppointments = await db
    .select({ id: appointments.id, createdAt: appointments.createdAt, paymentMethod: appointments.paymentMethod })
    .from(appointments)
    .where(and(eq(appointments.status, "pending"), inArray(appointments.paymentStatus, ["pending", "unpaid"])));

  for (const a of staleAppointments) {
    // tarjeta: 35 min de retencion. Bizum: 2 h.
    const holdMs = a.paymentMethod === "bizum" ? 2 * 3600_000 : 35 * 60_000;
    if (a.createdAt.getTime() + holdMs > now.getTime()) continue;
    await db
      .update(appointments)
      .set({ status: "cancelled", paymentStatus: "unpaid", updatedAt: now })
      .where(eq(appointments.id, a.id));
    report.expiredAppointments += 1;
  }

  // 5. Encargos pendientes de pago que caducaron
  const staleOrders = await db
    .select({ id: orders.id, createdAt: orders.createdAt })
    .from(orders)
    .where(eq(orders.status, "pending_payment"));

  for (const o of staleOrders) {
    if (o.createdAt.getTime() + 2 * 3600_000 > now.getTime()) continue;
    await db
      .update(orders)
      .set({ status: "cancelled", paymentStatus: "unpaid", updatedAt: now })
      .where(eq(orders.id, o.id));
    report.expiredOrders += 1;
  }

  // 6. Higiene de sesiones, contadores y registro de la ejecucion
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await pruneLimits();
  await db
    .insert(appSettings)
    .values({ key: "lifecycle_last_run", value: { at: now.toISOString(), ...report }, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: { at: now.toISOString(), ...report }, updatedAt: now },
    });

  return report;
}

/** Borrado real de datos operativos del comercio (pedidos, reservas, productos, imagenes). */
export async function deleteTenantData(tenantId: string): Promise<void> {
  await db.delete(appointments).where(eq(appointments.tenantId, tenantId));
  await db.delete(orders).where(eq(orders.tenantId, tenantId));
  // order_items cae por ON DELETE CASCADE de orders
  const { products } = await import("@/db/schema");
  await db.delete(products).where(eq(products.tenantId, tenantId));
  await db.delete(events).where(eq(events.tenantId, tenantId));
  const tenantUsers = await db.select({ id: users.id }).from(users).where(eq(users.tenantId, tenantId));
  if (tenantUsers.length) {
    await db.delete(sessions).where(
      inArray(
        sessions.userId,
        tenantUsers.map((u) => u.id),
      ),
    );
  }
}

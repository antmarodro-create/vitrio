"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, events, orders, plans, products, tenants, type Plan, type Tenant } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { parsePriceToCents } from "@/lib/money";
import { planHas, type FeatureKey } from "@/lib/plans";
import { publicCode } from "@/lib/booking";
import { addMinutes } from "@/lib/time";

export type AppState = { error: string | null; ok?: string | null };

type Ctx = { tenant: Tenant; plan: Plan | null };

async function loadCtx(required?: FeatureKey): Promise<Ctx> {
  const { tenant } = await requireTenant();
  let plan: Plan | null = null;
  if (tenant.planId) {
    const rows = await db.select().from(plans).where(eq(plans.id, tenant.planId)).limit(1);
    plan = rows[0] ?? null;
  }
  if (required && !planHas(plan, required)) {
    throw new Error("FEATURE");
  }
  return { tenant, plan };
}

function featureError(): AppState {
  return { error: "Tu plan actual no incluye esta función. Pide una ampliación desde Plan." };
}

/* -------------------------------- productos ------------------------------- */

function readImage(formData: FormData): Promise<string | null> {
  const file = formData.get("image");
  if (!file || typeof file === "string") return Promise.resolve(null);
  if (file.size === 0) return Promise.resolve(null);
  if (file.size > 2_500_000) return Promise.reject(new Error("IMG"));
  const type = file.type || "image/jpeg";
  if (!/^image\/(jpeg|png|webp)$/.test(type)) return Promise.reject(new Error("IMG"));
  return file.arrayBuffer().then((buf) => `data:${type};base64,${Buffer.from(buf).toString("base64")}`);
}

export async function saveProductAction(_prev: AppState, formData: FormData): Promise<AppState> {
  let ctx: Ctx;
  try {
    ctx = await loadCtx("catalog");
  } catch {
    return featureError();
  }
  const { tenant, plan } = ctx;

  const id = String(formData.get("id") ?? "") || null;
  const kind = String(formData.get("kind") ?? "product") === "service" ? "service" : "product";
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const priceCents = parsePriceToCents(String(formData.get("price") ?? "0"));
  const category = String(formData.get("category") ?? "").trim() || null;
  const visible = formData.get("visible") === "on";
  const durationMinutes = kind === "service" ? Math.max(5, Number(formData.get("durationMinutes") ?? 30)) : null;
  const capacity = kind === "service" ? Math.max(1, Number(formData.get("capacity") ?? 1)) : null;
  const depositCents = kind === "service" ? parsePriceToCents(String(formData.get("deposit") ?? "0")) : null;
  const removeImage = formData.get("removeImage") === "on";

  if (name.length < 2) return { error: "Pon un nombre al artículo." };

  let imageData: string | null = null;
  try {
    imageData = await readImage(formData);
  } catch {
    return { error: "La imagen debe ser JPG, PNG o WebP de menos de 2,5 MB." };
  }

  if (!id) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.tenantId, tenant.id));
    if (plan?.maxProducts !== null && plan?.maxProducts !== undefined && n >= plan.maxProducts) {
      return { error: `Tu plan permite ${plan.maxProducts} artículos. Borra alguno o amplía el plan.` };
    }

    await db.insert(products).values({
      tenantId: tenant.id,
      kind,
      name,
      description,
      priceCents,
      category,
      visible,
      durationMinutes,
      capacity,
      depositCents,
      imageData,
      sortOrder: n,
    });
  } else {
    const existing = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.tenantId, tenant.id)))
      .limit(1);
    if (!existing[0]) return { error: "Artículo no encontrado." };

    await db
      .update(products)
      .set({
        name,
        description,
        priceCents,
        category,
        visible,
        durationMinutes,
        capacity,
        depositCents,
        ...(imageData ? { imageData } : removeImage ? { imageData: null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.tenantId, tenant.id)));
  }

  revalidatePath("/app/catalogo");
  revalidatePath("/app/servicios");
  revalidatePath(`/c/${tenant.slug}`);
  return { error: null, ok: id ? "Artículo actualizado." : "Artículo añadido." };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const { tenant } = await requireTenant();
  const id = String(formData.get("id") ?? "");
  await db.delete(products).where(and(eq(products.id, id), eq(products.tenantId, tenant.id)));
  revalidatePath("/app/catalogo");
  revalidatePath("/app/servicios");
  revalidatePath(`/c/${tenant.slug}`);
}

export async function toggleProductAction(formData: FormData): Promise<void> {
  const { tenant } = await requireTenant();
  const id = String(formData.get("id") ?? "");
  await db
    .update(products)
    .set({ visible: sql`not ${products.visible}`, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.tenantId, tenant.id)));
  revalidatePath("/app/catalogo");
  revalidatePath("/app/servicios");
  revalidatePath(`/c/${tenant.slug}`);
}

/* --------------------------------- ajustes -------------------------------- */

function parseHours(formData: FormData): Record<string, string[][]> {
  const hours: Record<string, string[][]> = {};
  for (let day = 0; day < 7; day += 1) {
    const segments: string[][] = [];
    for (const slot of [1, 2]) {
      const from = String(formData.get(`d${day}_from${slot}`) ?? "").trim();
      const to = String(formData.get(`d${day}_to${slot}`) ?? "").trim();
      if (from && to && from < to) segments.push([from, to]);
    }
    hours[String(day)] = segments;
  }
  return hours;
}

export async function saveSettingsAction(_prev: AppState, formData: FormData): Promise<AppState> {
  const { tenant } = await requireTenant();

  const patch: Record<string, unknown> = { updatedAt: new Date(), hours: parseHours(formData) };
  patch.slotMinutes = Math.max(5, Math.min(120, Number(formData.get("slotMinutes") ?? 30)));
  patch.durationMinutes = Math.max(5, Math.min(480, Number(formData.get("durationMinutes") ?? 60)));
  patch.capacity = Math.max(1, Number(formData.get("capacity") ?? 4));
  patch.maxParty = Math.max(1, Number(formData.get("maxParty") ?? 8));
  patch.noticeMinutes = Math.max(0, Number(formData.get("noticeMinutes") ?? 120));
  patch.orderNoticeHours = Math.max(0, Number(formData.get("orderNoticeHours") ?? 2));
  patch.prepay = ["none", "deposit", "full"].includes(String(formData.get("prepay")))
    ? String(formData.get("prepay"))
    : "none";
  patch.depositCents = parsePriceToCents(String(formData.get("deposit") ?? "0"));
  patch.policyText = String(formData.get("policyText") ?? "").trim() || null;
  patch.whatsapp = String(formData.get("whatsapp") ?? "").trim().replace(/[^\d]/g, "") || null;
  patch.phone = String(formData.get("phone") ?? "").trim() || null;

  await db.update(tenants).set(patch).where(eq(tenants.id, tenant.id));
  revalidatePath("/app/ajustes");
  revalidatePath(`/c/${tenant.slug}`);
  return { error: null, ok: "Ajustes guardados." };
}

export async function toggleModuleAction(formData: FormData): Promise<void> {
  const { tenant, plan } = await loadCtx();
  const module = String(formData.get("module") ?? "");
  const now = new Date();

  if (module === "bookings") {
    if (!planHas(plan, "bookings")) return;
    await db.update(tenants).set({ bookingsEnabled: !tenant.bookingsEnabled, updatedAt: now }).where(eq(tenants.id, tenant.id));
  }
  if (module === "orders") {
    if (!planHas(plan, "orders")) return;
    await db.update(tenants).set({ ordersEnabled: !tenant.ordersEnabled, updatedAt: now }).where(eq(tenants.id, tenant.id));
  }
  if (module === "card") {
    await db
      .update(tenants)
      .set({ paymentCardEnabled: !tenant.paymentCardEnabled, updatedAt: now })
      .where(eq(tenants.id, tenant.id));
  }
  if (module === "bizum") {
    await db
      .update(tenants)
      .set({ paymentBizumEnabled: !tenant.paymentBizumEnabled, updatedAt: now })
      .where(eq(tenants.id, tenant.id));
  }
  revalidatePath("/app/ajustes");
  revalidatePath(`/c/${tenant.slug}`);
}

export async function saveProfileAction(_prev: AppState, formData: FormData): Promise<AppState> {
  const { tenant } = await requireTenant();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "El nombre es obligatorio." };

  let logoData: string | null = null;
  try {
    logoData = await readImage(formData);
  } catch {
    return { error: "El logo debe ser JPG, PNG o WebP de menos de 2,5 MB." };
  }

  await db
    .update(tenants)
    .set({
      name,
      address: String(formData.get("address") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      primaryColor: /^#[0-9a-fA-F]{6}$/.test(String(formData.get("primaryColor") ?? ""))
        ? String(formData.get("primaryColor"))
        : tenant.primaryColor,
      ...(logoData ? { logoData } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id));

  revalidatePath("/app/ajustes");
  revalidatePath(`/c/${tenant.slug}`);
  return { error: null, ok: "Perfil actualizado." };
}

/* ------------------------- reservas y encargos ---------------------------- */

const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"];
const ORDER_STATUSES = ["pending_payment", "new", "preparing", "ready", "completed", "cancelled"];

export async function setBookingStatusAction(formData: FormData): Promise<void> {
  const { tenant } = await requireTenant();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!BOOKING_STATUSES.includes(status)) return;

  const rows = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenant.id)))
    .limit(1);
  if (!rows[0]) return;

  // Una reserva pagada no se cancela desde la app: hay que reembolsar en Stripe.
  if (status === "cancelled" && rows[0].paymentStatus === "paid") {
    await db.insert(events).values({ tenantId: tenant.id, type: "cancel_blocked_paid", meta: { id } });
    return;
  }

  await db.update(appointments).set({ status, updatedAt: new Date() }).where(eq(appointments.id, id));
  revalidatePath("/app/reservas");
}

export async function setOrderStatusAction(formData: FormData): Promise<void> {
  const { tenant } = await requireTenant();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!ORDER_STATUSES.includes(status)) return;

  await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenant.id)));
  revalidatePath("/app/encargos");
}

/** Cita manual creada por el comercio (teléfono, mostrador). */
export async function createManualBookingAction(_prev: AppState, formData: FormData): Promise<AppState> {
  let ctx: Ctx;
  try {
    ctx = await loadCtx("bookings");
  } catch {
    return featureError();
  }
  const { tenant } = ctx;

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const partySize = Math.max(1, Number(formData.get("partySize") ?? 1));
  const productId = String(formData.get("productId") ?? "") || null;

  if (!name || !phone) return { error: "Nombre y teléfono son obligatorios." };
  if (!date || !time) return { error: "Indica fecha y hora." };

  const startsAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: "Fecha no válida." };

  let duration = tenant.durationMinutes;
  if (productId) {
    const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    duration = rows[0]?.durationMinutes ?? duration;
  }

  await db.insert(appointments).values({
    tenantId: tenant.id,
    productId,
    customerName: name,
    customerPhone: phone,
    partySize,
    startsAt,
    endsAt: addMinutes(startsAt, duration),
    status: "confirmed",
    source: "manual",
    code: publicCode(),
    paymentStatus: "none",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  revalidatePath("/app/reservas");
  return { error: null, ok: "Reserva añadida a la agenda." };
}

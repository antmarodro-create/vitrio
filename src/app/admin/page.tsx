import Link from "next/link";
import { and, desc, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, events, orders, plans, products, tenants } from "@/db/schema";
import { Badge, Card, CardBody, Empty, SectionTitle, Stat, btnGhost, btnSmall, statusLabel, statusTone } from "@/components/ui";
import { formatEUR } from "@/lib/money";
import { addDays, formatDateTime } from "@/lib/time";
import { businessTypeLabel } from "@/lib/plans";

export const metadata = { title: "Resumen" };
export const dynamic = "force-dynamic";

const TZ = "Europe/Madrid";

export default async function AdminDashboard() {
  const now = new Date();
  const in7 = addDays(now, 7);
  const last30 = addDays(now, -30);

  const statusRows = await db
    .select({ status: tenants.status, n: sql<number>`count(*)::int` })
    .from(tenants)
    .groupBy(tenants.status);
  const counts = Object.fromEntries(statusRows.map((r) => [r.status, r.n])) as Record<string, number>;

  const mrrRows = await db
    .select({ mrr: sql<number>`coalesce(sum(${plans.priceMonthlyCents}),0)::int` })
    .from(tenants)
    .innerJoin(plans, eq(plans.id, tenants.planId))
    .where(eq(tenants.status, "active"));
  const mrr = mrrRows[0]?.mrr ?? 0;

  const expiring = await db
    .select({ tenant: tenants, plan: plans })
    .from(tenants)
    .leftJoin(plans, eq(plans.id, tenants.planId))
    .where(and(eq(tenants.status, "trial"), isNotNull(tenants.trialEndsAt), lt(tenants.trialEndsAt, in7)))
    .orderBy(tenants.trialEndsAt)
    .limit(8);

  const requests = await db
    .select({ tenant: tenants, plan: plans })
    .from(tenants)
    .leftJoin(plans, eq(plans.id, tenants.planId))
    .where(eq(tenants.activationRequested, true))
    .orderBy(desc(tenants.activationRequestedAt))
    .limit(8);

  const usage = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(products),
    db.select({ n: sql<number>`count(*)::int` }).from(appointments).where(gt(appointments.createdAt, last30)),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(gt(orders.createdAt, last30)),
    db.select({ n: sql<number>`count(*)::int` }).from(events).where(and(eq(events.type, "qr_scan"), gt(events.createdAt, last30))),
  ]);
  const [productsCount, bookings30, orders30, scans30] = usage.map((r) => r[0]?.n ?? 0);

  const recent = await db
    .select({ tenant: tenants.name, slug: tenants.slug, status: tenants.status, createdAt: tenants.createdAt })
    .from(tenants)
    .where(eq(tenants.status, "trial"))
    .orderBy(desc(tenants.createdAt))
    .limit(5);

  const totalLive = (counts.trial ?? 0) + (counts.active ?? 0);
  const conversion = totalLive + (counts.frozen ?? 0) > 0
    ? Math.round(((counts.active ?? 0) / (totalLive + (counts.frozen ?? 0))) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="serif text-3xl leading-tight">Resumen</h1>
        <p className="mt-1 text-sm text-ink-500">
          Estado de la cartera. Los cobros de suscripción son manuales: «activar» aquí es lo que pone el comercio en
          producción.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="En prueba" value={counts.trial ?? 0} hint="30 días sin tarjeta" />
        <Stat label="Activos" value={counts.active ?? 0} hint={`${formatEUR(mrr)} de MRR estimado`} />
        <Stat label="Congelados" value={counts.frozen ?? 0} hint="14 días antes del borrado" />
        <Stat label="Conversión" value={`${conversion}%`} hint={`${counts.deleted ?? 0} eliminados`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <SectionTitle title="Solicitudes de activación" hint="Comercios que han pulsado «contratar»." />
            {requests.length === 0 ? (
              <Empty title="Ninguna solicitud" hint="Cuando un comercio pida activar el plan aparecerá aquí." />
            ) : (
              <ul className="divide-y divide-black/5">
                {requests.map(({ tenant, plan }) => (
                  <li key={tenant.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <Link href={`/admin/comercios/${tenant.id}`} className="text-sm font-medium hover:underline">
                        {tenant.name}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {plan?.name ?? "Sin plan"} · {formatDateTime(tenant.activationRequestedAt ?? tenant.updatedAt, TZ)}
                      </p>
                    </div>
                    <Link href={`/admin/comercios/${tenant.id}`} className={`${btnGhost} ${btnSmall}`}>
                      Activar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionTitle title="Pruebas que vencen en 7 días" hint="Aviso automático por email a los 3 y 1 días." />
            {expiring.length === 0 ? (
              <Empty title="Sin vencimientos próximos" />
            ) : (
              <ul className="divide-y divide-black/5">
                {expiring.map(({ tenant, plan }) => (
                  <li key={tenant.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <Link href={`/admin/comercios/${tenant.id}`} className="text-sm font-medium hover:underline">
                        {tenant.name}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {businessTypeLabel(tenant.businessType)} · {plan?.name ?? "sin plan"}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-amber-700">
                      {tenant.trialEndsAt ? formatDateTime(tenant.trialEndsAt, TZ) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Productos y servicios" value={productsCount} />
        <Stat label="Reservas (30 d)" value={bookings30} />
        <Stat label="Encargos (30 d)" value={orders30} />
        <Stat label="Escaneos QR (30 d)" value={scans30} />
      </div>

      <Card>
        <CardBody>
          <SectionTitle
            title="Altas recientes en prueba"
            action={
              <Link href="/admin/comercios/nuevo" className={btnGhost}>
                Nuevo comercio
              </Link>
            }
          />
          {recent.length === 0 ? (
            <Empty title="Todavía no hay comercios" hint="Daible de alta el primero para verlo aquí." />
          ) : (
            <ul className="divide-y divide-black/5">
              {recent.map((t) => (
                <li key={t.slug} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{t.tenant}</p>
                    <p className="text-xs text-ink-500">/c/{t.slug}</p>
                  </div>
                  <Badge tone={statusTone[t.status] ?? "neutral"}>{statusLabel[t.status] ?? t.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

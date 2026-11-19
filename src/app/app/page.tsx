import Link from "next/link";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, events, orders, plans, products } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { Badge, Card, CardBody, Empty, SectionTitle, Stat, btnBrand, btnGhost, btnSmall, statusLabel, statusTone } from "@/components/ui";
import { addDays, formatDateTime, formatTime, todayInTz, zonedToUtc } from "@/lib/time";
import { bookingLabel, usesPartySize } from "@/lib/booking";
import { planHas } from "@/lib/plans";
import { formatEUR } from "@/lib/money";

export const metadata = { title: "Resumen" };
export const dynamic = "force-dynamic";

export default async function TenantDashboard() {
  const { tenant } = await requireTenant();
  const plan = tenant.planId
    ? (await db.select().from(plans).where(eq(plans.id, tenant.planId)).limit(1))[0] ?? null
    : null;

  const today = todayInTz(tenant.timezone);
  const [y, m, d] = today.split("-").map(Number);
  const start = zonedToUtc(y, m, d, 0, 0, tenant.timezone);
  const end = zonedToUtc(y, m, d, 23, 59, tenant.timezone);

  const [todayBookings, upcoming, openOrders, counts, scans] = await Promise.all([
    db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenant.id),
          inArray(appointments.status, ["pending", "confirmed"]),
          gte(appointments.startsAt, start),
          lt(appointments.startsAt, end),
        ),
      )
      .orderBy(asc(appointments.startsAt)),
    db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenant.id),
          inArray(appointments.status, ["pending", "confirmed"]),
          gte(appointments.startsAt, end),
        ),
      )
      .orderBy(asc(appointments.startsAt))
      .limit(5),
    db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), inArray(orders.status, ["new", "preparing", "ready"])))
      .orderBy(asc(orders.createdAt))
      .limit(5),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.tenantId, tenant.id)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(events)
      .where(and(eq(events.tenantId, tenant.id), eq(events.type, "qr_scan"), gte(events.createdAt, addDays(new Date(), -30)))),
  ]);

  const guests = todayBookings.reduce((acc, a) => acc + (usesPartySize(tenant) ? a.partySize : 1), 0);
  const productCount = counts[0]?.n ?? 0;

  const checklist = [
    { done: productCount > 0, label: "Añade tu primer producto o servicio", href: "/app/catalogo" },
    { done: !!tenant.logoData || !!tenant.phone, label: "Completa los datos del comercio", href: "/app/ajustes" },
    { done: Object.values(tenant.hours ?? {}).some((v) => (v as string[][]).length > 0), label: "Configura tus horarios", href: "/app/ajustes" },
    { done: tenant.bookingsEnabled || tenant.ordersEnabled, label: "Activa reservas o encargos", href: "/app/ajustes" },
  ];
  const pendingSteps = checklist.filter((c) => !c.done);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {tenant.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            Tu catálogo público: <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs">/c/{tenant.slug}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/catalogo" className={btnBrand}>
            Añadir artículo
          </Link>
          <Link href="/app/qr" className={btnGhost}>
            Ver QR
          </Link>
        </div>
      </div>

      {pendingSteps.length > 0 ? (
        <Card>
          <CardBody>
            <SectionTitle title="Puesta en marcha" hint={`${checklist.length - pendingSteps.length} de ${checklist.length} pasos completados`} />
            <ul className="space-y-1.5 text-sm">
              {checklist.map((step) => (
                <li key={step.label} className="flex items-center gap-2">
                  <span className={step.done ? "text-brand-600" : "text-ink-300"}>{step.done ? "✓" : "○"}</span>
                  {step.done ? (
                    <span className="text-ink-300 line-through">{step.label}</span>
                  ) : (
                    <Link href={step.href} className="font-medium hover:underline">
                      {step.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hoy" value={todayBookings.length} hint={`${guests} ${usesPartySize(tenant) ? "comensales" : "citas"}`} />
        <Stat label="Encargos abiertos" value={openOrders.length} hint="Nuevos, en preparación o listos" />
        <Stat label="Artículos" value={productCount} hint={plan?.maxProducts ? `máx. ${plan.maxProducts}` : "sin límite"} />
        <Stat label="Escaneos QR (30 d)" value={scans[0]?.n ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <SectionTitle
              title={`${bookingLabel(tenant)}s de hoy`}
              action={
                planHas(plan, "bookings") ? (
                  <Link href="/app/reservas" className={`${btnGhost} ${btnSmall}`}>
                    Ver agenda
                  </Link>
                ) : null
              }
            />
            {todayBookings.length === 0 ? (
              <Empty
                title={`Sin ${bookingLabel(tenant).toLowerCase()}s para hoy`}
                hint={tenant.bookingsEnabled ? "Cuando alguien reserve desde el catálogo aparecerá aquí." : "Activa las reservas en Ajustes para empezar a recibirlas."}
              />
            ) : (
              <ul className="divide-y divide-black/5">
                {todayBookings.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <p className="text-sm font-medium">
                        {formatTime(a.startsAt, tenant.timezone)} · {a.customerName}
                      </p>
                      <p className="text-xs text-ink-500">
                        {a.partySize} {usesPartySize(tenant) ? "personas" : "cita"} · {a.customerPhone}
                      </p>
                    </div>
                    <Badge tone={statusTone[a.status] ?? "neutral"}>{statusLabel[a.status] ?? a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionTitle
              title="Próximas reservas"
              action={
                planHas(plan, "bookings") ? (
                  <Link href="/app/reservas" className={`${btnGhost} ${btnSmall}`}>
                    Agenda
                  </Link>
                ) : null
              }
            />
            {upcoming.length === 0 ? (
              <Empty title="Nada en los próximos días" />
            ) : (
              <ul className="divide-y divide-black/5">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{a.customerName}</p>
                      <p className="text-xs text-ink-500">{formatDateTime(a.startsAt, tenant.timezone)}</p>
                    </div>
                    <Badge tone={statusTone[a.status] ?? "neutral"}>{statusLabel[a.status] ?? a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {planHas(plan, "orders") ? (
        <Card>
          <CardBody>
            <SectionTitle
              title="Encargos abiertos"
              action={
                <Link href="/app/encargos" className={`${btnGhost} ${btnSmall}`}>
                  Gestionar
                </Link>
              }
            />
            {openOrders.length === 0 ? (
              <Empty title="Sin encargos pendientes" hint="Los pedidos del catálogo entran aquí con su hora de recogida." />
            ) : (
              <ul className="divide-y divide-black/5">
                {openOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <p className="text-sm font-medium">
                        {o.code} · {o.customerName}
                      </p>
                      <p className="text-xs text-ink-500">
                        {o.pickupAt ? `Recogida ${formatDateTime(o.pickupAt, tenant.timezone)}` : "Sin hora"} ·{" "}
                        {formatEUR(o.totalCents)}
                      </p>
                    </div>
                    <Badge tone={statusTone[o.status] ?? "neutral"}>{statusLabel[o.status] ?? o.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

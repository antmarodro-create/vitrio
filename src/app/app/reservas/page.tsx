import Link from "next/link";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, plans, products } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { Alert, Badge, Card, CardBody, Empty, SectionTitle, btnGhost, btnSmall, statusLabel, statusTone } from "@/components/ui";
import { addDays, formatDateTime, zonedToUtc, todayInTz } from "@/lib/time";
import { bookingLabel, usesPartySize } from "@/lib/booking";
import { formatEUR } from "@/lib/money";
import { planHas } from "@/lib/plans";
import { ManualBookingForm } from "../forms";
import { setBookingStatusAction } from "../actions";

export const metadata = { title: "Reservas" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "confirmed", label: "Confirmadas" },
  { key: "completed", label: "Completadas" },
  { key: "cancelled", label: "Canceladas" },
];

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { tenant } = await requireTenant();
  const { estado } = await searchParams;
  const filter = FILTERS.some((f) => f.key === estado) ? estado : "todas";
  const plan = tenant.planId ? (await db.select().from(plans).where(eq(plans.id, tenant.planId)).limit(1))[0] ?? null : null;

  const [y, m, d] = todayInTz(tenant.timezone).split("-").map(Number);
  const from = zonedToUtc(y, m, d, 0, 0, tenant.timezone);

  const conditions = [eq(appointments.tenantId, tenant.id), gte(appointments.startsAt, addDays(from, -1))];
  if (filter !== "todas" && filter) conditions.push(eq(appointments.status, filter));

  const rows = await db
    .select()
    .from(appointments)
    .where(and(...conditions))
    .orderBy(asc(appointments.startsAt))
    .limit(200);

  const services = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenant.id), eq(products.kind, "service")))
    .orderBy(asc(products.name));

  const paidPending = await db
    .select({ n: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenant.id), inArray(appointments.paymentStatus, ["pending"])))
    .limit(50);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`${bookingLabel(tenant)}s`}
        hint={`Agenda desde ayer. Registros con pago pendiente retenidos: ${paidPending.length}`}
      />

      {!tenant.bookingsEnabled ? (
        <Alert tone="warn">
          Las reservas online están desactivadas: puedes seguir apuntando reservas a mano. Actívalas en{" "}
          <Link href="/app/ajustes" className="underline">
            Ajustes
          </Link>
          .
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "todas" ? "/app/reservas" : `/app/reservas?estado=${f.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === f.key ? "bg-ink-950 text-white" : "bg-white text-ink-700 hover:bg-black/5"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {planHas(plan, "bookings") ? (
        <Card>
          <CardBody>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">Añadir reserva a mano</summary>
              <div className="mt-4">
                <ManualBookingForm services={services} />
              </div>
            </details>
          </CardBody>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Empty title="Sin reservas" hint="Las reservas del catálogo entran aquí automáticamente." />
      ) : (
        <div className="space-y-2">
          {rows.map((a) => {
            const waText = encodeURIComponent(
              `Hola ${a.customerName}, te confirmamos tu ${bookingLabel(tenant).toLowerCase()} en ${tenant.name} el ${formatDateTime(a.startsAt, tenant.timezone)}. Código: ${a.code}`,
            );
            const waPhone = (a.customerPhone ?? "").replace(/[^\d]/g, "");
            return (
              <Card key={a.id}>
                <CardBody className="flex flex-wrap items-start justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{a.customerName}</p>
                      <Badge tone={statusTone[a.status] ?? "neutral"}>{statusLabel[a.status] ?? a.status}</Badge>
                      {a.paymentStatus !== "none" ? (
                        <Badge tone={statusTone[a.paymentStatus] ?? "neutral"}>
                          {statusLabel[a.paymentStatus] ?? a.paymentStatus}
                          {a.depositCents ? ` · ${formatEUR(a.depositCents)}` : ""}
                        </Badge>
                      ) : null}
                      {a.source === "manual" ? <Badge tone="neutral">manual</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-700">
                      {formatDateTime(a.startsAt, tenant.timezone)} · {a.partySize}{" "}
                      {usesPartySize(tenant) ? "personas" : "cita"} · {a.customerPhone}
                    </p>
                    <p className="text-xs text-ink-500">
                      Código <code className="rounded bg-black/5 px-1">{a.code}</code>
                      {a.customerEmail ? ` · ${a.customerEmail}` : ""}
                    </p>
                    {a.notes ? <p className="mt-1 text-xs text-ink-500">Nota: {a.notes}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {waPhone ? (
                      <a
                        href={`https://wa.me/${waPhone}?text=${waText}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`${btnGhost} ${btnSmall}`}
                      >
                        WhatsApp
                      </a>
                    ) : null}
                    {a.status === "pending" ? (
                      <form action={setBookingStatusAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value="confirmed" />
                        <button className={`${btnGhost} ${btnSmall}`}>Confirmar</button>
                      </form>
                    ) : null}
                    {a.status === "confirmed" ? (
                      <form action={setBookingStatusAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value="completed" />
                        <button className={`${btnGhost} ${btnSmall}`}>Completar</button>
                      </form>
                    ) : null}
                    {a.status !== "cancelled" && a.status !== "completed" ? (
                      a.paymentStatus === "paid" ? (
                        <span className="text-xs text-ink-300" title="Reembolsa primero en Stripe">
                          Cancelar (pagada)
                        </span>
                      ) : (
                        <form action={setBookingStatusAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <button className={`${btnGhost} ${btnSmall} text-red-700`}>Cancelar</button>
                        </form>
                      )
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

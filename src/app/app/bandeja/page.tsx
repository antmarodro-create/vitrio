import Link from "next/link";
import { and, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, events, orders, products } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { Badge, Empty, Eyebrow } from "@/components/ui";
import { addDays, formatDateTime, formatTime } from "@/lib/time";
import { formatEUR } from "@/lib/money";
import { bookingLabel, usesPartySize } from "@/lib/booking";
import { setBookingStatusAction, setOrderStatusAction } from "../actions";

export const metadata = { title: "Bandeja" };
export const dynamic = "force-dynamic";

function relative(date: Date): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

type Tone = "green" | "amber" | "neutral" | "red" | "violet" | "blue";

const FEED: Record<string, { title: (meta: Record<string, unknown>) => string; tone: Tone; tag: string }> = {
  booking_created: { title: (m) => `Nueva solicitud de ${m.customer ?? "un cliente"}`, tone: "blue", tag: "Reserva" },
  booking_confirmed: { title: (m) => `Confirmaste la reserva de ${m.customer ?? "un cliente"}`, tone: "green", tag: "Confirmada" },
  booking_cancelled: { title: (m) => `Reserva cancelada · ${m.customer ?? "cliente"}`, tone: "red", tag: "Cancelada" },
  booking_completed: { title: (m) => `Reserva completada · ${m.customer ?? "cliente"}`, tone: "neutral", tag: "Completada" },
  order_created: { title: (m) => `Nuevo encargo de ${m.customer ?? "un cliente"}`, tone: "blue", tag: "Encargo" },
  order_preparing: { title: (m) => `Encargo en preparación · ${m.customer ?? "cliente"}`, tone: "amber", tag: "Preparando" },
  order_ready: { title: (m) => `Encargo listo para recoger · ${m.customer ?? "cliente"}`, tone: "violet", tag: "Listo" },
  order_completed: { title: (m) => `Encargo entregado · ${m.customer ?? "cliente"}`, tone: "neutral", tag: "Entregado" },
  order_cancelled: { title: (m) => `Encargo cancelado · ${m.customer ?? "cliente"}`, tone: "red", tag: "Cancelado" },
  payment_paid: { title: (m) => `Pago recibido · ${m.customer ?? "cliente"}`, tone: "green", tag: "Cobrado" },
};

export default async function InboxPage() {
  const { tenant } = await requireTenant();

  const [pendingBookings, newOrders, feed] = await Promise.all([
    db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenant.id),
          eq(appointments.status, "pending"),
          gte(appointments.startsAt, addDays(new Date(), -1)),
        ),
      )
      .orderBy(appointments.startsAt)
      .limit(12),
    db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.status, "new")))
      .orderBy(desc(orders.createdAt))
      .limit(12),
    db
      .select()
      .from(events)
      .where(and(eq(events.tenantId, tenant.id), ne(events.type, "qr_scan"), gte(events.createdAt, addDays(new Date(), -14))))
      .orderBy(desc(events.createdAt))
      .limit(40),
  ]);

  const serviceIds = pendingBookings.map((b) => b.productId).filter(Boolean) as string[];
  const serviceRows = serviceIds.length
    ? await db.select().from(products).where(inArray(products.id, serviceIds))
    : [];
  const serviceName = new Map(serviceRows.map((p) => [p.id, p.name]));

  const total = pendingBookings.length + newOrders.length;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Bandeja de entrada</Eyebrow>
          <h1 className="serif mt-3 text-3xl leading-tight sm:text-4xl">
            {total === 0 ? "Todo al día" : `${total} ${total === 1 ? "mensaje" : "mensajes"} por revisar`}
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Lo que entra desde tu web pública aparece aquí al instante. Confirmar es un clic.
          </p>
        </div>
        <Link href={`/c/${tenant.slug}`} target="_blank" className="eyebrow border-b border-ink-950/40 pb-1">
          Ver mi web ↗
        </Link>
      </div>

      {/* ------------------------ pendientes de ti ------------------------ */}
      <section>
        <div className="flex items-baseline gap-3">
          <h2 className="serif text-xl">Pendiente de tu respuesta</h2>
          <span className="h-px flex-1 bg-ink-950/12" />
        </div>

        {total === 0 ? (
          <div className="mt-4">
            <Empty
              title="Nada pendiente"
              hint="Cuando alguien reserve o encargue desde tu catálogo, lo verás aquí con su nombre y teléfono."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-ink-950/10 border-y border-ink-950/10">
            {pendingBookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{b.customerName}</span>
                    <span className="text-ink-500"> · {b.customerPhone}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-500">
                    {bookingLabel(tenant)} · {formatDateTime(b.startsAt, tenant.timezone)}
                    {usesPartySize(tenant) ? ` · ${b.partySize} personas` : b.productId ? ` · ${serviceName.get(b.productId) ?? ""}` : ""}
                  </p>
                  {b.notes ? <p className="mt-1 text-[11px] text-ink-300">“{b.notes}”</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <form action={setBookingStatusAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="status" value="confirmed" />
                    <button className="bg-ink-950 px-3 py-2 text-[11px] font-semibold tracking-wide text-ivory hover:bg-ink-900">
                      Confirmar
                    </button>
                  </form>
                  <form action={setBookingStatusAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="status" value="cancelled" />
                    <button className="border border-ink-950/20 px-3 py-2 text-[11px] font-medium text-ink-500 hover:border-clay/40 hover:text-clay">
                      Rechazar
                    </button>
                  </form>
                </div>
              </li>
            ))}

            {newOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{o.customerName}</span>
                    <span className="text-ink-500"> · {o.customerPhone}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-500">
                    Encargo {o.code} · {formatEUR(o.totalCents)}
                    {o.pickupAt ? ` · recogida ${formatDateTime(o.pickupAt, tenant.timezone)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={setOrderStatusAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="status" value="preparing" />
                    <button className="bg-ink-950 px-3 py-2 text-[11px] font-semibold tracking-wide text-ivory hover:bg-ink-900">
                      Aceptar
                    </button>
                  </form>
                  <Link
                    href="/app/encargos"
                    className="border border-ink-950/20 px-3 py-2 text-[11px] font-medium text-ink-500 hover:border-ink-950/40"
                  >
                    Ver detalle
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------- actividad --------------------------- */}
      <section>
        <div className="flex items-baseline gap-3">
          <h2 className="serif text-xl">Últimos movimientos</h2>
          <span className="h-px flex-1 bg-ink-950/12" />
          <span className="eyebrow-sm text-ink-300">14 días</span>
        </div>

        {feed.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">Sin movimientos todavía.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {feed.map((event) => {
              const meta = (event.meta ?? {}) as Record<string, unknown>;
              const spec = FEED[event.type];
              const title = spec ? spec.title(meta) : event.type;
              return (
                <li key={event.id} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-brand-500/70" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug">{title}</p>
                    <p className="text-[11px] text-ink-300">
                      {relative(event.createdAt)} · {formatTime(event.createdAt, tenant.timezone)}
                      {typeof meta.code === "string" ? ` · ${meta.code}` : ""}
                    </p>
                  </div>
                  {spec ? <Badge tone={spec.tone}>{spec.tag}</Badge> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

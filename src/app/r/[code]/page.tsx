import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, events, products, tenants } from "@/db/schema";
import { settlePayment } from "@/lib/stripe";
import { formatDateTime } from "@/lib/time";
import { formatEUR } from "@/lib/money";
import { bookingLabel, usesPartySize } from "@/lib/booking";
import { Alert, Badge, Eyebrow, statusLabel, statusTone } from "@/components/ui";
import { startPaymentAction } from "@/app/c/[slug]/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu reserva" };

function relative(date: Date): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

const EVENT_TEXT: Record<string, string> = {
  booking_created: "Solicitud enviada al comercio",
  booking_confirmed: "Confirmada por el comercio",
  booking_cancelled: "Cancelada",
  booking_completed: "Servicio completado",
  payment_paid: "Pago recibido",
};

export default async function BookingTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ pago?: string; session_id?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;

  if (sp.session_id) {
    await settlePayment(sp.session_id).catch(() => null);
  }

  const rows = await db
    .select({ booking: appointments, tenant: tenants, product: products })
    .from(appointments)
    .innerJoin(tenants, eq(tenants.id, appointments.tenantId))
    .leftJoin(products, eq(products.id, appointments.productId))
    .where(eq(appointments.code, code.toUpperCase()))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();
  const { booking, tenant, product } = row;

  const timeline = await db
    .select({ type: events.type, createdAt: events.createdAt })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenant.id),
        sql`(${events.meta}->>'code') = ${booking.code}`,
        sql`${events.type} in ('booking_created','booking_confirmed','booking_cancelled','booking_completed','payment_paid')`,
      ),
    )
    .orderBy(events.createdAt)
    .limit(10);

  const pendingPayment = booking.depositCents > 0 && booking.paymentStatus !== "paid" && booking.status !== "cancelled";
  const cancelled = booking.status === "cancelled";
  const heading = cancelled ? "Reserva cancelada" : booking.status === "confirmed" ? "Reserva confirmada" : "Solicitud recibida";
  const subheading = cancelled
    ? "El comercio ha cancelado esta reserva. Si ya pagaste una señal, contacta con ellos."
    : booking.status === "confirmed"
      ? "El comercio te espera. Guarda tu código para identificarte."
      : "El comercio acaba de recibir tu solicitud y te confirmará en breve.";

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link
        href={`/c/${tenant.slug}`}
        className="text-[11px] uppercase tracking-[0.18em] text-ink-300 transition hover:text-ink-950"
      >
        Volver a {tenant.name}
      </Link>

      <div className="mt-6">
        <Eyebrow>{bookingLabel(tenant)}</Eyebrow>
        <h1 className="serif mt-3 text-3xl leading-tight">{heading}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{subheading}</p>
      </div>

      {/* ticket */}
      <div className="mt-6 border border-ink-950/15 bg-white">
        <div className="flex items-start justify-between gap-4 border-b border-dashed border-ink-950/20 px-5 py-4">
          <div>
            <p className="eyebrow-sm text-ink-300">Cuándo</p>
            <p className="serif mt-1 text-lg leading-tight">{formatDateTime(booking.startsAt, tenant.timezone)}</p>
          </div>
          <Badge tone={statusTone[booking.status] ?? "neutral"}>
            {statusLabel[booking.status] ?? booking.status}
          </Badge>
        </div>

        <dl className="divide-y divide-ink-950/8 px-5 text-sm">
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-ink-500">A nombre de</dt>
            <dd>{booking.customerName}</dd>
          </div>
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-ink-500">{usesPartySize(tenant) ? "Personas" : "Servicio"}</dt>
            <dd>{usesPartySize(tenant) ? booking.partySize : product?.name ?? "Cita"}</dd>
          </div>
          {product && usesPartySize(tenant) ? (
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-ink-500">Servicio</dt>
              <dd>{product.name}</dd>
            </div>
          ) : null}
          {booking.depositCents > 0 ? (
            <div className="flex justify-between gap-3 py-2.5">
              <dt className="text-ink-500">Señal</dt>
              <dd className="flex items-center gap-2">
                {formatEUR(booking.depositCents)}
                <Badge tone={statusTone[booking.paymentStatus] ?? "neutral"}>
                  {statusLabel[booking.paymentStatus] ?? booking.paymentStatus}
                </Badge>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="border-t border-dashed border-ink-950/20 px-5 py-4">
          <p className="eyebrow-sm text-ink-300">Tu código</p>
          <p className="mt-1 font-mono text-xl tracking-[0.22em]">{booking.code}</p>
        </div>
      </div>

      {sp.pago === "cancelado" ? (
        <div className="mt-4">
          <Alert tone="warn">No se ha completado el pago. Puedes intentarlo otra vez.</Alert>
        </div>
      ) : null}
      {sp.pago === "error" ? (
        <div className="mt-4">
          <Alert tone="error">No hemos podido iniciar el pago. Inténtalo más tarde.</Alert>
        </div>
      ) : null}

      {pendingPayment ? (
        <form action={startPaymentAction} className="mt-4">
          <input type="hidden" name="code" value={booking.code} />
          <input type="hidden" name="kind" value="booking" />
          <button className="w-full bg-brand-600 px-4 py-3.5 text-[13px] font-semibold tracking-wide text-white hover:bg-brand-700">
            Pagar la señal ({formatEUR(booking.depositCents)})
          </button>
          <p className="mt-2 text-center text-[11px] text-ink-500">
            El hueco queda retenido mientras completas el pago.
          </p>
        </form>
      ) : null}

      {booking.paymentStatus === "paid" ? (
        <div className="mt-4">
          <Alert tone="success">Pago recibido. ¡Gracias!</Alert>
        </div>
      ) : null}

      {/* trazas: prueba de que el mensaje llegó al comercio */}
      <section className="mt-8">
        <p className="eyebrow-sm text-ink-300">Seguimiento</p>
        <ol className="mt-4 space-y-4">
          {timeline.length === 0 ? (
            <li className="text-[13px] text-ink-500">Solicitud registrada.</li>
          ) : (
            timeline.map((event, index) => (
              <li key={`${event.type}-${index}`} className="flex gap-3">
                <span className="relative mt-1.5 flex h-2 w-2 flex-none">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      index === timeline.length - 1 ? "bg-brand-600" : "bg-ink-950/25"
                    }`}
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug">{EVENT_TEXT[event.type] ?? event.type}</p>
                  <p className="text-[11px] text-ink-300">
                    {relative(event.createdAt)} · {formatDateTime(event.createdAt, tenant.timezone)}
                  </p>
                </div>
              </li>
            ))
          )}
        </ol>
        <p className="mt-5 text-[11px] leading-relaxed text-ink-300">
          Cada movimiento se registra en el panel del comercio, que confirma desde ahí.
        </p>
      </section>

      {tenant.policyText ? (
        <p className="mt-6 border-t border-ink-950/10 pt-4 text-[11px] leading-relaxed text-ink-500">
          {tenant.policyText}
        </p>
      ) : null}

      <div className="mt-6 flex gap-2">
        <Link
          href={`/c/${tenant.slug}`}
          className="flex-1 border border-ink-950/15 px-4 py-3 text-center text-[13px] font-medium hover:border-ink-950/40"
        >
          Ver la carta
        </Link>
        {tenant.whatsapp ? (
          <a
            href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, mi reserva es ${booking.code}`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 border border-ink-950/15 px-4 py-3 text-center text-[13px] font-medium hover:border-ink-950/40"
          >
            Escribir al comercio
          </a>
        ) : null}
      </div>
    </main>
  );
}

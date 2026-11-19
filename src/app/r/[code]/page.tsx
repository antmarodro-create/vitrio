import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, products, tenants } from "@/db/schema";
import { settlePayment } from "@/lib/stripe";
import { formatDateTime } from "@/lib/time";
import { formatEUR } from "@/lib/money";
import { bookingLabel, usesPartySize } from "@/lib/booking";
import { Alert, Badge, Card, CardBody, btnBrand, btnGhost, statusLabel, statusTone } from "@/components/ui";
import { startPaymentAction } from "@/app/c/[slug]/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu reserva" };

export default async function BookingTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ pago?: string; session_id?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;

  // Verificacion real del pago al volver de Stripe (nunca se fia de la URL)
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

  const pendingPayment = booking.depositCents > 0 && booking.paymentStatus !== "paid" && booking.status !== "cancelled";
  const cancelled = booking.status === "cancelled";

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Link href={`/c/${tenant.slug}`} className="text-xs text-ink-500 hover:text-ink-950">
        ← {tenant.name}
      </Link>

      <Card className="mt-3">
        <CardBody className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{bookingLabel(tenant)}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{cancelled ? "Cancelada" : "Confirmada"}</h1>
            <p className="text-sm text-ink-500">{formatDateTime(booking.startsAt, tenant.timezone)}</p>
          </div>

          <div className="rounded-xl bg-black/[0.03] px-4 py-3">
            <p className="text-xs text-ink-500">Tu código</p>
            <p className="font-mono text-lg font-semibold tracking-widest">{booking.code}</p>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">A nombre de</dt>
              <dd>{booking.customerName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">{usesPartySize(tenant) ? "Personas" : "Servicio"}</dt>
              <dd>{usesPartySize(tenant) ? booking.partySize : product?.name ?? "Cita"}</dd>
            </div>
            {product && usesPartySize(tenant) ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Servicio</dt>
                <dd>{product.name}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Estado</dt>
              <dd>
                <Badge tone={statusTone[booking.status] ?? "neutral"}>{statusLabel[booking.status] ?? booking.status}</Badge>
              </dd>
            </div>
            {booking.depositCents > 0 ? (
              <div className="flex justify-between gap-3">
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

          {sp.pago === "cancelado" ? <Alert tone="warn">No se ha completado el pago. Puedes intentarlo otra vez.</Alert> : null}
          {sp.pago === "error" ? <Alert tone="error">No hemos podido iniciar el pago. Inténtalo más tarde.</Alert> : null}

          {pendingPayment ? (
            <form action={startPaymentAction}>
              <input type="hidden" name="code" value={booking.code} />
              <input type="hidden" name="kind" value="booking" />
              <button className={`${btnBrand} w-full`}>Pagar la señal ({formatEUR(booking.depositCents)})</button>
              <p className="mt-2 text-center text-xs text-ink-500">
                El hueco queda retenido mientras completas el pago.
              </p>
            </form>
          ) : null}

          {booking.paymentStatus === "paid" ? <Alert tone="success">Pago recibido. ¡Gracias!</Alert> : null}

          {tenant.policyText ? <p className="text-xs text-ink-500">{tenant.policyText}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Link href={`/c/${tenant.slug}`} className={`${btnGhost} flex-1`}>
              Ver catálogo
            </Link>
            {tenant.whatsapp ? (
              <a
                href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, mi reserva es ${booking.code}`)}`}
                target="_blank"
                rel="noreferrer"
                className={`${btnGhost} flex-1`}
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </main>
  );
}

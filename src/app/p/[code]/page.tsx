import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, orderItems, orders, tenants } from "@/db/schema";
import { settlePayment } from "@/lib/stripe";
import { formatDateTime } from "@/lib/time";
import { formatEUR } from "@/lib/money";
import { Alert, Badge, Eyebrow } from "@/components/ui";
import { startPaymentAction } from "@/app/c/[slug]/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu encargo" };

const STEPS = [
  { key: "new", label: "Recibido" },
  { key: "preparing", label: "En preparación" },
  { key: "ready", label: "Listo" },
  { key: "completed", label: "Entregado" },
];

const EVENT_TEXT: Record<string, string> = {
  order_created: "Encargo enviado al comercio",
  order_preparing: "El comercio lo está preparando",
  order_ready: "Listo para recoger",
  order_completed: "Entregado",
  order_cancelled: "Cancelado por el comercio",
  payment_paid: "Pago recibido",
};

export default async function OrderTrackingPage({
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
    .select({ order: orders, tenant: tenants })
    .from(orders)
    .innerJoin(tenants, eq(tenants.id, orders.tenantId))
    .where(eq(orders.code, code.toUpperCase()))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();
  const { order, tenant } = row;
  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

  const timeline = await db
    .select({ type: events.type, createdAt: events.createdAt })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenant.id),
        sql`(${events.meta}->>'code') = ${order.code}`,
        sql`${events.type} like 'order_%' or ${events.type} = 'payment_paid'`,
      ),
    )
    .orderBy(events.createdAt)
    .limit(10);

  const pendingPayment = order.paymentStatus === "pending" && order.status !== "cancelled";
  const currentStep = STEPS.findIndex((s) => s.key === order.status);
  const cancelled = order.status === "cancelled";

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link
        href={`/c/${tenant.slug}`}
        className="text-[11px] uppercase tracking-[0.18em] text-ink-300 transition hover:text-ink-950"
      >
        Volver a {tenant.name}
      </Link>

      <div className="mt-6">
        <Eyebrow>Encargo</Eyebrow>
        <h1 className="serif mt-3 text-3xl leading-tight">
          {cancelled ? "Encargo cancelado" : order.status === "ready" ? "Listo para recoger" : "Hemos recibido tu encargo"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
          {order.mode === "delivery" ? "Entrega" : "Recogida"}
          {order.pickupAt ? ` · ${formatDateTime(order.pickupAt, tenant.timezone)}` : ""}
        </p>
      </div>

      <div className="mt-6 border border-ink-950/15 bg-white">
        {!cancelled ? (
          <ol className="flex border-b border-dashed border-ink-950/20">
            {STEPS.map((step, index) => {
              const done = index <= currentStep;
              return (
                <li key={step.key} className="flex-1 px-2 py-3 text-center">
                  <span className={`mx-auto mb-1.5 block h-px w-full ${done ? "bg-brand-600" : "bg-ink-950/15"}`} />
                  <span className={`eyebrow-sm ${done ? "text-ink-900" : "text-ink-300"}`}>{step.label}</span>
                </li>
              );
            })}
          </ol>
        ) : null}

        <ul className="divide-y divide-ink-950/8 px-5 py-2 text-sm">
          {lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3 py-2">
              <span>
                <span className="text-ink-500">{line.qty}×</span> {line.name}
              </span>
              <span className="tabular-nums">{formatEUR(line.subtotalCents)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 py-2.5 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatEUR(order.totalCents)}</span>
          </li>
        </ul>

        <div className="flex items-center justify-between border-t border-dashed border-ink-950/20 px-5 py-3">
          <div>
            <p className="eyebrow-sm text-ink-300">Tu código</p>
            <p className="mt-1 font-mono text-lg tracking-[0.22em]">{order.code}</p>
          </div>
          <Badge tone={order.paymentStatus === "paid" ? "green" : "neutral"}>
            {order.paymentStatus === "paid" ? "Pagado" : "Se paga al recoger"}
          </Badge>
        </div>
      </div>

      {sp.pago === "cancelado" ? (
        <div className="mt-4">
          <Alert tone="warn">Pago cancelado. Tu encargo sigue pendiente.</Alert>
        </div>
      ) : null}

      {pendingPayment ? (
        <form action={startPaymentAction} className="mt-4">
          <input type="hidden" name="code" value={order.code} />
          <input type="hidden" name="kind" value="order" />
          <button className="w-full bg-brand-600 px-4 py-3.5 text-[13px] font-semibold tracking-wide text-white hover:bg-brand-700">
            Pagar {formatEUR(order.totalCents)}
          </button>
        </form>
      ) : null}

      <section className="mt-8">
        <p className="eyebrow-sm text-ink-300">Seguimiento</p>
        <ol className="mt-4 space-y-4">
          {timeline.length === 0 ? (
            <li className="text-[13px] text-ink-500">Encargo registrado.</li>
          ) : (
            timeline.map((event, index) => (
              <li key={`${event.type}-${index}`} className="flex gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                    index === timeline.length - 1 ? "bg-brand-600" : "bg-ink-950/25"
                  }`}
                />
                <div>
                  <p className="text-[13px] leading-snug">{EVENT_TEXT[event.type] ?? event.type}</p>
                  <p className="text-[11px] text-ink-300">{formatDateTime(event.createdAt, tenant.timezone)}</p>
                </div>
              </li>
            ))
          )}
        </ol>
      </section>

      <Link
        href={`/c/${tenant.slug}`}
        className="mt-8 block border border-ink-950/15 px-4 py-3 text-center text-[13px] font-medium hover:border-ink-950/40"
      >
        Seguir mirando la carta
      </Link>
    </main>
  );
}

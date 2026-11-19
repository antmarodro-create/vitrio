import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, tenants } from "@/db/schema";
import { settlePayment } from "@/lib/stripe";
import { formatDateTime } from "@/lib/time";
import { formatEUR } from "@/lib/money";
import { Alert, Badge, Card, CardBody, btnBrand, btnGhost, statusLabel, statusTone } from "@/components/ui";
import { startPaymentAction } from "@/app/c/[slug]/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu encargo" };

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

  const pendingPayment = order.paymentStatus === "pending" && order.status !== "cancelled";
  const steps = ["new", "preparing", "ready", "completed"];
  const currentStep = steps.indexOf(order.status);

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Link href={`/c/${tenant.slug}`} className="text-xs text-ink-500 hover:text-ink-950">
        ← {tenant.name}
      </Link>

      <Card className="mt-3">
        <CardBody className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Encargo</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {order.status === "cancelled" ? "Cancelado" : statusLabel[order.status] ?? order.status}
            </h1>
            <p className="text-sm text-ink-500">
              {order.mode === "delivery" ? "Entrega" : "Recogida"}
              {order.pickupAt ? ` · ${formatDateTime(order.pickupAt, tenant.timezone)}` : ""}
            </p>
          </div>

          <div className="rounded-xl bg-black/[0.03] px-4 py-3">
            <p className="text-xs text-ink-500">Tu código</p>
            <p className="font-mono text-lg font-semibold tracking-widest">{order.code}</p>
          </div>

          {order.status !== "cancelled" && order.status !== "pending_payment" ? (
            <ol className="flex justify-between gap-1 text-center text-[11px]">
              {[
                { key: "new", label: "Recibido" },
                { key: "preparing", label: "Preparando" },
                { key: "ready", label: "Listo" },
                { key: "completed", label: "Entregado" },
              ].map((step, index) => (
                <li key={step.key} className="flex-1">
                  <div
                    className={`mx-auto mb-1 h-1.5 rounded-full ${index <= currentStep ? "bg-brand-600" : "bg-black/10"}`}
                  />
                  <span className={index <= currentStep ? "font-medium" : "text-ink-300"}>{step.label}</span>
                </li>
              ))}
            </ol>
          ) : null}

          <ul className="space-y-1 rounded-xl border border-black/10 px-3 py-2 text-sm">
            {lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-2 py-0.5">
                <span>
                  {line.qty}× {line.name}
                </span>
                <span className="tabular-nums text-ink-500">{formatEUR(line.subtotalCents)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-2 border-t border-black/5 pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatEUR(order.totalCents)}</span>
            </li>
          </ul>

          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-500">Pago</span>
            <Badge tone={statusTone[order.paymentStatus] ?? "neutral"}>
              {statusLabel[order.paymentStatus] ?? order.paymentStatus}
            </Badge>
          </div>

          {sp.pago === "cancelado" ? <Alert tone="warn">Pago cancelado. Tu encargo sigue pendiente.</Alert> : null}

          {pendingPayment ? (
            <form action={startPaymentAction}>
              <input type="hidden" name="code" value={order.code} />
              <input type="hidden" name="kind" value="order" />
              <button className={`${btnBrand} w-full`}>Pagar {formatEUR(order.totalCents)}</button>
            </form>
          ) : null}

          {order.paymentStatus === "paid" ? <Alert tone="success">Pago recibido. ¡Gracias!</Alert> : null}

          <Link href={`/c/${tenant.slug}`} className={`${btnGhost} w-full`}>
            Seguir comprando
          </Link>
        </CardBody>
      </Card>
    </main>
  );
}

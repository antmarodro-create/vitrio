import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { Alert, Badge, Card, CardBody, Empty, SectionTitle, btnGhost, btnSmall, statusLabel, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { formatEUR } from "@/lib/money";
import { setOrderStatusAction } from "../actions";

export const metadata = { title: "Encargos" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "abiertos", label: "Abiertos" },
  { key: "todos", label: "Todos" },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { tenant } = await requireTenant();
  const { ver } = await searchParams;
  const showAll = ver === "todos";

  const conditions = [eq(orders.tenantId, tenant.id)];
  if (!showAll) conditions.push(inArray(orders.status, ["new", "preparing", "ready", "pending_payment"]));

  const rows = await db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  const items = rows.length
    ? await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, rows.map((r) => r.id)))
    : [];

  return (
    <div className="space-y-6">
      <SectionTitle title="Encargos" hint="Pedidos del catálogo con hora de recogida o entrega." />

      {!tenant.ordersEnabled ? (
        <Alert tone="warn">
          Los encargos online están desactivados.{" "}
          <Link href="/app/ajustes" className="underline">
            Actívalos en Ajustes
          </Link>
          .
        </Alert>
      ) : null}

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "abiertos" ? "/app/encargos" : "/app/encargos?ver=todos"}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              (showAll ? "todos" : "abiertos") === f.key ? "bg-ink-950 text-white" : "bg-white text-ink-700 hover:bg-black/5"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty title="Sin encargos" hint="Cuando un cliente haga un pedido aparecerá aquí." />
      ) : (
        <div className="space-y-2">
          {rows.map((order) => {
            const lines = items.filter((i) => i.orderId === order.id);
            const next =
              order.status === "new"
                ? "preparing"
                : order.status === "preparing"
                  ? "ready"
                  : order.status === "ready"
                    ? "completed"
                    : null;
            return (
              <Card key={order.id}>
                <CardBody className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{order.code}</p>
                        <Badge tone={statusTone[order.status] ?? "neutral"}>{statusLabel[order.status] ?? order.status}</Badge>
                        <Badge tone={statusTone[order.paymentStatus] ?? "neutral"}>
                          {statusLabel[order.paymentStatus] ?? order.paymentStatus}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-700">
                        {order.customerName} · {order.customerPhone}
                      </p>
                      <p className="text-xs text-ink-500">
                        {order.mode === "delivery" ? "Entrega" : "Recogida"}
                        {order.pickupAt ? ` · ${formatDateTime(order.pickupAt, tenant.timezone)}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatEUR(order.totalCents)}</p>
                      <p className="text-xs text-ink-500">{formatDateTime(order.createdAt, tenant.timezone)}</p>
                    </div>
                  </div>

                  <ul className="rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
                    {lines.map((line) => (
                      <li key={line.id} className="flex justify-between gap-2 py-0.5">
                        <span>
                          {line.qty}× {line.name}
                        </span>
                        <span className="tabular-nums text-ink-500">{formatEUR(line.subtotalCents)}</span>
                      </li>
                    ))}
                  </ul>

                  {order.notes ? <p className="text-xs text-ink-500">Nota: {order.notes}</p> : null}

                  <div className="flex flex-wrap gap-1.5">
                    {next ? (
                      <form action={setOrderStatusAction}>
                        <input type="hidden" name="id" value={order.id} />
                        <input type="hidden" name="status" value={next} />
                        <button className={`${btnGhost} ${btnSmall}`}>
                          {next === "preparing" ? "Empezar" : next === "ready" ? "Marcar listo" : "Entregado"}
                        </button>
                      </form>
                    ) : null}
                    {order.status !== "cancelled" && order.status !== "completed" ? (
                      order.paymentStatus === "paid" ? (
                        <span className="self-center text-xs text-ink-300" title="Reembolsa primero en Stripe">
                          Cancelar (pagado)
                        </span>
                      ) : (
                        <form action={setOrderStatusAction}>
                          <input type="hidden" name="id" value={order.id} />
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

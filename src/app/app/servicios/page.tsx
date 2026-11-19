import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, products } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { Alert, Badge, Card, CardBody, Empty, SectionTitle, btnGhost, btnSmall } from "@/components/ui";
import { formatEUR } from "@/lib/money";
import { planHas } from "@/lib/plans";
import { ProductForm } from "../forms";
import { deleteProductAction, toggleProductAction } from "../actions";

export const metadata = { title: "Servicios" };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const { tenant } = await requireTenant();
  const plan = tenant.planId ? (await db.select().from(plans).where(eq(plans.id, tenant.planId)).limit(1))[0] ?? null : null;

  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenant.id), eq(products.kind, "service")))
    .orderBy(asc(products.sortOrder), asc(products.name));

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Servicios reservables"
        hint="Cada servicio tiene duración, aforo y su propia señal."
        action={
          <Link href="/app/reservas" className={btnGhost}>
            Ver agenda
          </Link>
        }
      />

      {!tenant.bookingsEnabled ? (
        <Alert tone="warn">
          Las reservas están desactivadas. Actívalas en{" "}
          <Link href="/app/ajustes" className="underline">
            Ajustes
          </Link>{" "}
          para que los clientes puedan reservar.
        </Alert>
      ) : null}

      {!planHas(plan, "bookings") ? (
        <Alert tone="warn">
          Tu plan no incluye reservas. Los servicios se pueden listar, pero no reservar.{" "}
          <Link href="/app/plan" className="underline">
            Ver planes
          </Link>
        </Alert>
      ) : null}

      <Card>
        <CardBody>
          <details open={rows.length === 0}>
            <summary className="cursor-pointer text-sm font-semibold">Añadir servicio</summary>
            <div className="mt-4">
              <ProductForm kind="service" />
            </div>
          </details>
        </CardBody>
      </Card>

      {rows.length === 0 ? (
        <Empty title="Sin servicios" hint="Añade «Corte de pelo», «Manicura» o el servicio que reserves por cita." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((service) => (
            <Card key={service.id}>
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-ink-500">
                      {service.durationMinutes ?? 30} min · {service.capacity ?? 1} simultánea(s)
                      {service.depositCents ? ` · señal ${formatEUR(service.depositCents)}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatEUR(service.priceCents)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={service.visible ? "green" : "neutral"}>{service.visible ? "Visible" : "Oculto"}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={toggleProductAction}>
                    <input type="hidden" name="id" value={service.id} />
                    <button className={`${btnGhost} ${btnSmall}`}>{service.visible ? "Ocultar" : "Mostrar"}</button>
                  </form>
                  <form action={deleteProductAction}>
                    <input type="hidden" name="id" value={service.id} />
                    <button className={`${btnGhost} ${btnSmall} text-red-700`}>Borrar</button>
                  </form>
                </div>
                <details>
                  <summary className="cursor-pointer text-xs font-medium text-ink-500">Editar</summary>
                  <div className="mt-3 border-t border-black/5 pt-3">
                    <ProductForm kind="service" product={service} />
                  </div>
                </details>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

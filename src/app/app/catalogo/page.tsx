import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, products } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { Badge, Card, CardBody, Empty, SectionTitle, btnGhost, btnSmall } from "@/components/ui";
import { formatEUR } from "@/lib/money";
import { ProductForm } from "../forms";
import { deleteProductAction, toggleProductAction } from "../actions";

export const metadata = { title: "Catálogo" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const { tenant } = await requireTenant();
  const plan = tenant.planId ? (await db.select().from(plans).where(eq(plans.id, tenant.planId)).limit(1))[0] ?? null : null;

  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenant.id), eq(products.kind, "product")))
    .orderBy(asc(products.sortOrder), asc(products.name));

  const limitReached = plan?.maxProducts != null && rows.length >= plan.maxProducts;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Catálogo"
        hint={`${rows.length}${plan?.maxProducts ? ` de ${plan.maxProducts}` : ""} artículos · visible en /c/${tenant.slug}`}
        action={
          <Link href={`/c/${tenant.slug}`} target="_blank" className={btnGhost}>
            Ver como cliente ↗
          </Link>
        }
      />

      <Card>
        <CardBody>
          <details open={rows.length === 0}>
            <summary className="cursor-pointer text-sm font-semibold">Añadir producto</summary>
            <div className="mt-4">
              {limitReached ? (
                <p className="text-sm text-amber-700">
                  Has llegado al límite de tu plan.{" "}
                  <Link href="/app/plan" className="underline">
                    Ampliar plan
                  </Link>
                </p>
              ) : (
                <ProductForm kind="product" />
              )}
            </div>
          </details>
        </CardBody>
      </Card>

      {rows.length === 0 ? (
        <Empty title="Tu catálogo está vacío" hint="Añade tu primer producto para que aparezca en el QR." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((product) => (
            <Card key={product.id}>
              <CardBody className="space-y-3">
                <div className="flex gap-3">
                  {product.imageData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/img/${product.id}`}
                      alt={product.name}
                      className="h-16 w-16 flex-none rounded-xl object-cover"
                    />
                  ) : (
                    <div className="grid h-16 w-16 flex-none place-items-center rounded-xl bg-black/5 text-xs text-ink-300">
                      sin foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium">{product.name}</p>
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{formatEUR(product.priceCents)}</span>
                    </div>
                    {product.category ? <p className="text-xs text-ink-500">{product.category}</p> : null}
                    {product.description ? <p className="mt-1 line-clamp-2 text-xs text-ink-500">{product.description}</p> : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={product.visible ? "green" : "neutral"}>{product.visible ? "Visible" : "Oculto"}</Badge>
                      {product.imageData ? <Badge tone="blue">foto</Badge> : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <form action={toggleProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <button className={`${btnGhost} ${btnSmall}`}>{product.visible ? "Ocultar" : "Mostrar"}</button>
                  </form>
                  <form action={deleteProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <button className={`${btnGhost} ${btnSmall} text-red-700`}>Borrar</button>
                  </form>
                </div>

                <details>
                  <summary className="cursor-pointer text-xs font-medium text-ink-500">Editar</summary>
                  <div className="mt-3 border-t border-black/5 pt-3">
                    <ProductForm kind="product" product={product} />
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/public";
import { formatEUR } from "@/lib/money";
import { planHas } from "@/lib/plans";
import { bookingLabel } from "@/lib/booking";
import { Empty, Eyebrow } from "@/components/ui";
import { CatalogList } from "./catalog-list";

/**
 * El catálogo se regenera como mucho una vez por minuto y se sirve desde el CDN
 * de Netlify. Al filtrar en el navegador ya no depende de la URL, así que la
 * misma página vale para todos los visitantes: es lo que evita el viaje a la
 * base de datos en cada visita.
 */
export const revalidate = 60;

export default async function PublicCatalog({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicTenant(slug);
  if (!data) notFound();
  const { tenant, plan, products, services } = data;

  // Solo los campos que se pintan: las fotos se sirven por /api/img/<id>, así
  // que el base64 no viaja al navegador dentro del HTML.
  const catalog = products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    priceCents: product.priceCents,
    hasImage: Boolean(product.imageData),
  }));

  const canReserve = tenant.bookingsEnabled && planHas(plan, "bookings");
  const canOrder = tenant.ordersEnabled && planHas(plan, "orders") && products.length > 0;
  const hasCatalog = planHas(plan, "catalog");

  // Lo que el comercio podría tener y su plan no incluye: se le enseña al visitante
  // como invitación, no como error.
  const upsell: string[] = [];
  if (!planHas(plan, "bookings")) upsell.push("reservas con agenda y aforo");
  if (!planHas(plan, "orders")) upsell.push("encargos con hora de recogida");
  if (!planHas(plan, "payments")) upsell.push("señales con tarjeta y Bizum");

  return (
    <div className="space-y-10">
      {products.length === 0 && services.length === 0 ? (
        <Empty title="Carta en preparación" hint="Este comercio todavía no ha publicado artículos." />
      ) : null}

      <CatalogList slug={slug} products={catalog} canOrder={canOrder} />

      {/* --------------------------- servicios ---------------------------- */}
      {services.length > 0 && canReserve ? (
        <section className="space-y-5">
          <div className="flex items-baseline gap-3">
            <h2 className="serif text-2xl">Reserva tu cita</h2>
            <span className="h-px flex-1 bg-ink-950/12" />
          </div>
          <ul className="divide-y divide-ink-950/10 border-y border-ink-950/10">
            {services.map((service) => (
              <li key={service.id} className="flex items-center gap-4 py-4">
                {service.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/img/${service.id}`} alt="" className="h-16 w-16 flex-none object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <h3 className="serif text-base leading-snug">{service.name}</h3>
                  <p className="eyebrow-sm mt-1 text-ink-300">
                    {service.durationMinutes ?? 30} min
                    {service.depositCents ? ` · señal ${formatEUR(service.depositCents)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums">{formatEUR(service.priceCents)}</p>
                  <Link
                    href={`/c/${slug}/reservar?servicio=${service.id}`}
                    className="eyebrow mt-1 inline-block text-brand-700 hover:text-brand-600"
                  >
                    Elegir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------ invitación al plan ---------------------- */}
      {upsell.length > 0 ? (
        <section className="border border-brand-500/30 bg-brand-50/60 p-6">
          <Eyebrow>Este comercio usa el plan {plan?.name ?? "Básico"}</Eyebrow>
          <p className="serif mt-3 text-xl leading-snug">
            Aquí podrían estar tus reservas, tus encargos y tus señales.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            Este comercio ha publicado su carta, pero su plan no incluye{" "}
            {upsell.length > 1 ? `${upsell.slice(0, -1).join(", ")} ni ${upsell.at(-1)}` : upsell[0]}. Se activan en
            un minuto y sin comisiones por venta.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/#planes" className="eyebrow border-b border-ink-950/40 pb-1 hover:border-ink-950">
              Ver planes
            </Link>
            <Link href="/c/bodega-lumiere" className="eyebrow border-b border-brand-700/40 pb-1 text-brand-700">
              Ver un ejemplo con reservas
            </Link>
          </div>
        </section>
      ) : null}

      {tenant.policyText ? (
        <p className="border-t border-ink-950/10 pt-5 text-[11px] leading-relaxed text-ink-500">
          {tenant.policyText}
        </p>
      ) : null}

      {!hasCatalog ? (
        <p className="text-xs text-ink-500">Este comercio no tiene el catálogo activo en su plan.</p>
      ) : null}

      {/* --------------------------- acción fija -------------------------- */}
      {canReserve || canOrder ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-950/10 bg-paper/95 backdrop-blur no-print">
          <div className="mx-auto flex max-w-3xl items-stretch gap-2 px-4 py-3">
            {canReserve ? (
              <Link
                href={`/c/${slug}/reservar`}
                className="flex-1 border border-ink-950 bg-transparent px-4 py-3 text-center text-[13px] font-semibold tracking-wide hover:bg-ink-950 hover:text-ivory"
              >
                {bookingLabel(tenant)}
              </Link>
            ) : null}
            {canOrder ? (
              <Link
                href={`/c/${slug}/encargo`}
                className="flex-1 bg-ink-950 px-4 py-3 text-center text-[13px] font-semibold tracking-wide text-ivory hover:bg-ink-900"
              >
                Hacer encargo
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

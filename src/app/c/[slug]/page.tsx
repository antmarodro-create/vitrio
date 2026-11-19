import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/public";
import { formatEUR } from "@/lib/money";
import { planHas } from "@/lib/plans";
import { bookingLabel } from "@/lib/booking";
import { Empty, Eyebrow } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PublicCatalog({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { slug } = await params;
  const { q, cat } = await searchParams;
  const data = await getPublicTenant(slug);
  if (!data) notFound();
  const { tenant, plan, products, services } = data;

  const search = (q ?? "").trim().toLowerCase();
  const filtered = products.filter((p) => {
    const matchesText =
      !search || p.name.toLowerCase().includes(search) || (p.description ?? "").toLowerCase().includes(search);
    const matchesCat = !cat || p.category === cat;
    return matchesText && matchesCat;
  });

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
  const grouped = new Map<string, typeof filtered>();
  for (const product of filtered) {
    const key = product.category ?? "Otros";
    grouped.set(key, [...(grouped.get(key) ?? []), product]);
  }

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

      {/* --------------------------- buscador ---------------------------- */}
      {products.length > 3 ? (
        <form className="flex items-center gap-3 border-b border-ink-950/15 pb-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar en la carta"
            className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-ink-300"
          />
          <button className="eyebrow text-brand-700 hover:text-brand-600">Buscar</button>
        </form>
      ) : null}

      {/* -------------------------- categorías --------------------------- */}
      {categories.length > 1 ? (
        <div className="-mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href={`/c/${slug}${search ? `?q=${encodeURIComponent(search)}` : ""}`}
            className={`eyebrow pb-0.5 ${
              !cat ? "border-b border-ink-950 text-ink-950" : "text-ink-300 hover:text-ink-700"
            }`}
          >
            Todo
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={`/c/${slug}?cat=${encodeURIComponent(category)}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              className={`eyebrow pb-0.5 ${
                cat === category ? "border-b border-ink-950 text-ink-950" : "text-ink-300 hover:text-ink-700"
              }`}
            >
              {category}
            </Link>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 && products.length > 0 ? (
        <Empty title="Sin resultados" hint="Prueba con otra búsqueda o quita el filtro." />
      ) : null}

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

      {/* ---------------------------- la carta ---------------------------- */}
      {[...grouped.entries()].map(([category, items]) => (
        <section key={category} className="space-y-5">
          <div className="flex items-baseline gap-3">
            <h2 className="serif text-2xl">{category}</h2>
            <span className="h-px flex-1 bg-ink-950/12" />
            <span className="eyebrow-sm text-ink-300">{items.length}</span>
          </div>

          <ul className="space-y-6">
            {items.map((product) => (
              <li key={product.id} className="group">
                <div className="flex gap-4">
                  {product.imageData ? (
                    <Link
                      href={canOrder ? `/c/${slug}/encargo?add=${product.id}` : `/c/${slug}`}
                      className="relative h-20 w-20 flex-none overflow-hidden bg-ink-900/5 sm:h-24 sm:w-24"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/img/${product.id}`}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                    </Link>
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <h3 className="serif text-lg leading-snug">{product.name}</h3>
                      <span className="leader" aria-hidden />
                      <span className="whitespace-nowrap text-sm font-medium tabular-nums">
                        {formatEUR(product.priceCents)}
                      </span>
                    </div>
                    {product.description ? (
                      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink-500">{product.description}</p>
                    ) : null}
                    {canOrder ? (
                      <Link
                        href={`/c/${slug}/encargo?add=${product.id}`}
                        className="eyebrow mt-2 inline-block text-brand-700 hover:text-brand-600"
                      >
                        Añadir al encargo
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

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

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/public";
import { formatEUR } from "@/lib/money";
import { planHas } from "@/lib/plans";
import { Empty } from "@/components/ui";

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
    const matchesText = !search || p.name.toLowerCase().includes(search) || (p.description ?? "").toLowerCase().includes(search);
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

  return (
    <div className="space-y-5">
      {products.length === 0 && services.length === 0 ? (
        <Empty title="Catálogo en preparación" hint="Este comercio todavía no ha publicado artículos." />
      ) : null}

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar en el catálogo…"
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600"
        />
        <button className="rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white">Buscar</button>
      </form>

      {categories.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={`/c/${slug}${search ? `?q=${encodeURIComponent(search)}` : ""}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${!cat ? "bg-ink-950 text-white" : "bg-white text-ink-700 hover:bg-black/5"}`}
          >
            Todo
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={`/c/${slug}?cat=${encodeURIComponent(category)}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                cat === category ? "bg-ink-950 text-white" : "bg-white text-ink-700 hover:bg-black/5"
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

      {[...grouped.entries()].map(([category, items]) => (
        <section key={category} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500">{category}</h2>
          <div className="space-y-2">
            {items.map((product) => (
              <article
                key={product.id}
                className="flex gap-3 rounded-2xl border border-black/8 bg-white p-3"
              >
                {product.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/img/${product.id}`} alt={product.name} className="h-20 w-20 flex-none rounded-xl object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-snug">{product.name}</h3>
                    <span className="whitespace-nowrap font-semibold tabular-nums">{formatEUR(product.priceCents)}</span>
                  </div>
                  {product.description ? <p className="mt-0.5 text-sm text-ink-500">{product.description}</p> : null}
                  {canOrder ? (
                    <Link
                      href={`/c/${slug}/encargo?add=${product.id}`}
                      className="mt-2 inline-block rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold hover:bg-black/[0.03]"
                    >
                      Añadir al encargo
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {services.length > 0 && canReserve ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Servicios</h2>
          <div className="space-y-2">
            {services.map((service) => (
              <article key={service.id} className="rounded-2xl border border-black/8 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    <p className="text-xs text-ink-500">
                      {service.durationMinutes ?? 30} min
                      {service.depositCents ? ` · señal ${formatEUR(service.depositCents)}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatEUR(service.priceCents)}</span>
                </div>
                <Link
                  href={`/c/${slug}/reservar?servicio=${service.id}`}
                  className="mt-2 inline-block rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Pedir cita
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {canReserve || canOrder ? (
        <div className="sticky bottom-3 z-10 flex gap-2 rounded-2xl border border-black/10 bg-white/95 p-2 shadow-lg backdrop-blur">
          {canReserve ? (
            <Link
              href={`/c/${slug}/reservar`}
              className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-center text-sm font-semibold hover:bg-black/[0.03]"
            >
              Reservar
            </Link>
          ) : null}
          {canOrder ? (
            <Link
              href={`/c/${slug}/encargo`}
              className="flex-1 rounded-xl bg-ink-950 px-3 py-2 text-center text-sm font-semibold text-white"
            >
              Hacer encargo
            </Link>
          ) : null}
        </div>
      ) : null}

      {tenant.policyText ? <p className="pt-2 text-xs text-ink-500">{tenant.policyText}</p> : null}
    </div>
  );
}

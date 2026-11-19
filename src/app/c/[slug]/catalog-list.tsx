"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatEUR } from "@/lib/money";
import { Empty } from "@/components/ui";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceCents: number;
  hasImage: boolean;
};

/**
 * La carta con buscador y filtros. Se filtra EN EL NAVEGADOR: así la página no
 * depende de la URL, puede servirse cacheada desde el CDN de Netlify y buscar
 * es instantáneo (antes cada búsqueda era una ida y vuelta al servidor).
 */
export function CatalogList({
  slug,
  products,
  canOrder,
}: {
  slug: string;
  products: Product[];
  canOrder: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products],
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesText =
        !search ||
        p.name.toLowerCase().includes(search) ||
        (p.description ?? "").toLowerCase().includes(search);
      const matchesCategory = !category || p.category === category;
      return matchesText && matchesCategory;
    });
  }, [products, query, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of filtered) {
      const key = product.category ?? "Otros";
      const list = map.get(key);
      if (list) list.push(product);
      else map.set(key, [product]);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <>
      {/* --------------------------- buscador ---------------------------- */}
      {products.length > 3 ? (
        <form
          className="flex items-center gap-3 border-b border-ink-950/15 pb-2"
          onSubmit={(event) => event.preventDefault()}
          role="search"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar en la carta"
            aria-label="Buscar en la carta"
            className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-ink-300"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="eyebrow text-ink-300 hover:text-ink-700"
            >
              Limpiar
            </button>
          ) : (
            <span className="eyebrow text-ink-300">Buscar</span>
          )}
        </form>
      ) : null}

      {/* -------------------------- categorías --------------------------- */}
      {categories.length > 1 ? (
        <div className="-mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`eyebrow pb-0.5 ${
              !category ? "border-b border-ink-950 text-ink-950" : "text-ink-300 hover:text-ink-700"
            }`}
          >
            Todo
          </button>
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item === category ? null : item)}
              className={`eyebrow pb-0.5 ${
                category === item ? "border-b border-ink-950 text-ink-950" : "text-ink-300 hover:text-ink-700"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 && products.length > 0 ? (
        <Empty title="Sin resultados" hint="Prueba con otra búsqueda o quita el filtro." />
      ) : null}

      {/* ---------------------------- la carta ---------------------------- */}
      {grouped.map(([name, items]) => (
        <section key={name} className="space-y-5">
          <div className="flex items-baseline gap-3">
            <h2 className="serif text-2xl">{name}</h2>
            <span className="h-px flex-1 bg-ink-950/12" />
            <span className="eyebrow-sm text-ink-300">{items.length}</span>
          </div>

          <ul className="space-y-6">
            {items.map((product) => (
              <li key={product.id} className="group">
                <div className="flex gap-4">
                  {product.hasImage ? (
                    <Link
                      href={canOrder ? `/c/${slug}/encargo?add=${product.id}` : `/c/${slug}`}
                      className="relative h-20 w-20 flex-none overflow-hidden bg-ink-900/5 sm:h-24 sm:w-24"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/img/${product.id}`}
                        alt={product.name}
                        loading="lazy"
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
    </>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import { createOrderAction, type PublicState } from "./actions";
import { Alert, Field, inputClass } from "@/components/ui";
import { formatEUR } from "@/lib/money";
import type { Product } from "@/db/schema";

const initial: PublicState = { error: null };

export function CartForm({
  slug,
  products,
  initialAdd,
  noticeHours,
  policy,
  requiresPayment,
}: {
  slug: string;
  products: Product[];
  initialAdd?: string;
  noticeHours: number;
  policy?: string | null;
  requiresPayment: boolean;
}) {
  const [state, action, pending] = useActionState(createOrderAction, initial);
  const [cart, setCart] = useState<Record<string, number>>(() => {
    if (initialAdd && products.some((p) => p.id === initialAdd)) return { [initialAdd]: 1 };
    return {};
  });
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup");

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const product = products.find((p) => p.id === id);
          if (!product || qty <= 0) return null;
          return { product, qty, subtotal: product.priceCents * qty };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null),
    [cart, products],
  );

  const total = lines.reduce((acc, l) => acc + l.subtotal, 0);
  const count = lines.reduce((acc, l) => acc + l.qty, 0);

  const change = (id: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const value = (next[id] ?? 0) + delta;
      if (value <= 0) delete next[id];
      else next[id] = Math.min(50, value);
      return next;
    });
  };

  const minPickup = new Date(Date.now() + noticeHours * 3600_000 + 5 * 60_000);
  const minValue = new Date(minPickup.getTime() - minPickup.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <form action={action} className="space-y-5 pb-24">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="items" value={JSON.stringify(lines.map((l) => ({ id: l.product.id, qty: l.qty })))} />
      <input type="hidden" name="mode" value={mode} />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        {products.map((product) => {
          const qty = cart[product.id] ?? 0;
          return (
            <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white p-3">
              {product.imageData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/img/${product.id}`} alt="" className="h-14 w-14 flex-none rounded-xl object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-xs text-ink-500">{formatEUR(product.priceCents)}</p>
              </div>
              {qty === 0 ? (
                <button
                  type="button"
                  onClick={() => change(product.id, 1)}
                  className="rounded-xl border border-black/10 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.03]"
                >
                  Añadir
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => change(product.id, -1)}
                    className="h-8 w-8 rounded-lg border border-black/10 text-sm font-semibold"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={() => change(product.id, 1)}
                    className="h-8 w-8 rounded-lg border border-black/10 text-sm font-semibold"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {count > 0 ? (
        <div className="space-y-4 rounded-2xl border border-black/10 bg-white p-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Entrega</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setMode("pickup")}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${mode === "pickup" ? "bg-ink-950 text-white" : "border border-black/10"}`}
              >
                Recoger en tienda
              </button>
              <button
                type="button"
                onClick={() => setMode("delivery")}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${mode === "delivery" ? "bg-ink-950 text-white" : "border border-black/10"}`}
              >
                Entrega
              </button>
            </div>
          </div>

          <Field
            label="¿Cuándo lo quieres?"
            hint={noticeHours > 0 ? `Con al menos ${noticeHours} h de antelación.` : "Indica la hora que prefieras."}
          >
            <input className={inputClass} type="datetime-local" name="pickupAt" min={minValue} required />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre">
              <input className={inputClass} name="name" required autoComplete="name" />
            </Field>
            <Field label="Teléfono">
              <input className={inputClass} name="phone" required inputMode="tel" autoComplete="tel" />
            </Field>
          </div>
          <Field label="Email (opcional)">
            <input className={inputClass} type="email" name="email" autoComplete="email" />
          </Field>
          <Field label="Notas (opcional)">
            <textarea className={inputClass} name="notes" rows={2} placeholder="Sin cebolla, llamar al llegar…" />
          </Field>

          {policy ? <p className="rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-ink-500">{policy}</p> : null}
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-500">{count} artículo{count === 1 ? "" : "s"}</p>
            <p className="text-lg font-semibold tabular-nums">{formatEUR(total)}</p>
          </div>
          <button
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={pending || count === 0}
          >
            {pending ? "Enviando…" : requiresPayment ? "Pagar encargo" : "Confirmar encargo"}
          </button>
        </div>
      </div>
    </form>
  );
}

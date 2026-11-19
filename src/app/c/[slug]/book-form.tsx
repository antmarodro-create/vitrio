"use client";

import { useActionState } from "react";
import { createBookingAction, type PublicState } from "./actions";
import { Alert, Field, inputClass } from "@/components/ui";

const initial: PublicState = { error: null };

export function BookForm({
  slug,
  startsAt,
  productId,
  partySize,
  label,
  price,
  policy,
  playingWithParty,
}: {
  slug: string;
  startsAt: string;
  productId: string | null;
  partySize: number;
  label: string;
  price: string;
  policy?: string | null;
  playingWithParty: boolean;
}) {
  const [state, action, pending] = useActionState(createBookingAction, initial);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-black/10 bg-white p-4">
      <div>
        <p className="text-sm font-semibold">Confirma tu {label.toLowerCase()}</p>
        <p className="text-xs text-ink-500">
          {price}
          {playingWithParty ? ` · ${partySize} ${partySize === 1 ? "persona" : "personas"}` : ""}
        </p>
      </div>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <input type="hidden" name="partySize" value={partySize} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}

      <Field label="Nombre">
        <input className={inputClass} name="name" required autoComplete="name" placeholder="Tu nombre" />
      </Field>
      <Field label="Teléfono">
        <input className={inputClass} name="phone" required autoComplete="tel" inputMode="tel" placeholder="600 000 000" />
      </Field>
      <Field label="Email (opcional)" hint="Para recibir el código y los avisos.">
        <input className={inputClass} name="email" type="email" autoComplete="email" placeholder="tu@email.com" />
      </Field>
      <Field label="Notas (opcional)">
        <textarea className={inputClass} name="notes" rows={2} placeholder="Alergias, carrito, etc." />
      </Field>

      {policy ? <p className="rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-ink-500">{policy}</p> : null}

      <button
        className="w-full rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Reservando…" : "Confirmar reserva"}
      </button>
    </form>
  );
}

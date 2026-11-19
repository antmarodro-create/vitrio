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
    <form action={action} className="border-t-2 border-ink-950 pt-6">
      <p className="eyebrow-sm text-ink-300">Tus datos</p>
      <h2 className="serif mt-2 text-2xl">
        Confirma tu {label.toLowerCase()}
        {playingWithParty ? ` · ${partySize} ${partySize === 1 ? "persona" : "personas"}` : ""}
      </h2>
      <p className="mt-1 text-[13px] text-ink-500">{price}</p>

      {state.error ? (
        <div className="mt-4">
          <Alert tone="error">{state.error}</Alert>
        </div>
      ) : null}

      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <input type="hidden" name="partySize" value={partySize} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <input className={inputClass} name="name" required autoComplete="name" placeholder="Tu nombre" />
        </Field>
        <Field label="Teléfono">
          <input className={inputClass} name="phone" required autoComplete="tel" inputMode="tel" placeholder="600 000 000" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Email (opcional)" hint="Te enviamos el código y los avisos.">
          <input className={inputClass} name="email" type="email" autoComplete="email" placeholder="tu@email.com" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Notas (opcional)">
          <textarea className={inputClass} name="notes" rows={2} placeholder="Alergias, carrito, mobiliario…" />
        </Field>
      </div>

      {policy ? <p className="mt-4 bg-ivory-deep/60 px-4 py-3 text-[11px] leading-relaxed text-ink-500">{policy}</p> : null}

      <button
        className="mt-5 w-full bg-ink-950 px-4 py-3.5 text-[13px] font-semibold tracking-wide text-ivory transition hover:bg-ink-900 disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Enviando…" : `Confirmar ${label.toLowerCase()}`}
      </button>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-300">
        Al confirmar, la solicitud llega al panel del comercio al instante y recibes un código de seguimiento.
      </p>
    </form>
  );
}

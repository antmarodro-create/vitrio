/**
 * Aviso de que los cobros son de prueba. Sin esto es fácil pensar que un pago
 * con 4242 ha entrado de verdad en la cuenta del comercio.
 */
export function StripeModeBanner({ mode }: { mode: "test" | "live" | null }) {
  if (mode !== "test") return null;

  return (
    <div className="border-b border-brand-500/40 bg-brand-50/80 no-print">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
        <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white">
          Modo test
        </span>
        <p className="text-[11px] leading-tight text-brand-700">
          Stripe está en pruebas: los cobros con tarjeta son ficticios y no mueven dinero real.
        </p>
      </div>
    </div>
  );
}

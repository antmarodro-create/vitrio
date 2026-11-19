import type { ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------- cajas --------------------------------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[3px] border border-ink-950/12 bg-white/70 shadow-[0_1px_0_rgba(20,17,13,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-5 sm:p-6", className)}>{children}</div>;
}

/** Etiqueta de sección: micro-mayúsculas con guion de latón. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("eyebrow inline-flex items-baseline gap-2 text-brand-700", className)}>
      <span aria-hidden className="inline-block h-px w-6 translate-y-[-3px] bg-brand-500/70" />
      {children}
    </p>
  );
}

export function Rule({ className = "" }: { className?: string }) {
  return <hr className={cn("rule my-4", className)} />;
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="serif text-xl leading-tight">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-ink-500">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <CardBody className="p-4 sm:p-5">
        <p className="eyebrow-sm text-ink-500">{label}</p>
        <p className="serif mt-2 text-3xl tabular-nums leading-none">{value}</p>
        {hint ? <p className="mt-2 text-xs text-ink-500">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

/* --------------------------------- etiquetas -------------------------------- */

const badgeTones: Record<string, string> = {
  neutral: "border-ink-950/15 bg-ivory-deep/60 text-ink-700",
  green: "border-forest/25 bg-forest/8 text-forest",
  amber: "border-brand-500/40 bg-brand-50 text-brand-700",
  red: "border-clay/30 bg-clay/8 text-clay",
  blue: "border-ink-950/20 bg-white text-ink-700",
  violet: "border-plum/30 bg-plum/8 text-plum",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        badgeTones[tone] ?? badgeTones.neutral,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------- formulario ------------------------------- */

export const inputClass =
  "w-full rounded-[3px] border border-ink-950/15 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-ink-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15 disabled:opacity-60";

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-[3px] px-4 py-2.5 text-[13px] font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = cn(btn, "bg-ink-950 text-ivory hover:bg-ink-900");
export const btnBrand = cn(btn, "bg-brand-600 text-white hover:bg-brand-700");
export const btnGhost = cn(btn, "border border-ink-950/15 bg-white/60 text-ink-900 hover:bg-ivory-deep/70");
export const btnDanger = cn(btn, "border border-clay/30 bg-white text-clay hover:bg-clay/8");
export const btnSmall = "px-3 py-1.5 text-[11px]";

/** Botón de acción principal del catálogo público. */
export const btnLine = cn(
  btn,
  "border-b border-ink-950/40 rounded-none bg-transparent px-0 pb-1 text-ink-900 hover:border-ink-950",
);

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="eyebrow-sm mb-1.5 block text-ink-500">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px] text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function Alert({ tone = "neutral", children }: { tone?: "neutral" | "error" | "success" | "warn"; children: ReactNode }) {
  const tones = {
    neutral: "border-ink-950/15 bg-white text-ink-700",
    error: "border-clay/30 bg-clay/8 text-clay",
    success: "border-forest/25 bg-forest/8 text-forest",
    warn: "border-brand-500/40 bg-brand-50 text-brand-700",
  };
  return <div className={cn("rounded-[3px] border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-[3px] border border-dashed border-ink-950/20 bg-white/50 px-6 py-12 text-center">
      <p className="serif text-lg">{title}</p>
      {hint ? <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-500">{hint}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export const statusTone: Record<string, keyof typeof badgeTones> = {
  trial: "blue",
  active: "green",
  frozen: "amber",
  deleted: "red",
  pending: "amber",
  confirmed: "green",
  cancelled: "red",
  completed: "neutral",
  new: "blue",
  preparing: "amber",
  ready: "violet",
  pending_payment: "amber",
  none: "neutral",
  unpaid: "red",
  paid: "green",
  refunded: "violet",
};

export const statusLabel: Record<string, string> = {
  trial: "Prueba",
  active: "Activo",
  frozen: "Congelado",
  deleted: "Eliminado",
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  new: "Nuevo",
  preparing: "Preparando",
  ready: "Listo",
  pending_payment: "Pendiente de pago",
  none: "Sin pago",
  unpaid: "Impagado",
  paid: "Pagado",
  refunded: "Reembolsado",
};

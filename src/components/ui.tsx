import type { ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------- cajas --------------------------------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-black/8 bg-white shadow-[0_1px_2px_rgba(10,15,18,0.04)]", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-5 sm:p-6", className)}>{children}</div>;
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-ink-500">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <CardBody className="p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

const badgeTones: Record<string, string> = {
  neutral: "bg-black/5 text-ink-700",
  green: "bg-brand-50 text-brand-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  blue: "bg-sky-50 text-sky-700",
  violet: "bg-violet-50 text-violet-700",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof badgeTones }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone] ?? badgeTones.neutral)}>
      {children}
    </span>
  );
}

/* -------------------------------- formulario ------------------------------- */

export const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60";

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = cn(btn, "bg-ink-950 text-white hover:bg-ink-900");
export const btnBrand = cn(btn, "bg-brand-600 text-white hover:bg-brand-700");
export const btnGhost = cn(btn, "border border-black/10 bg-white hover:bg-black/[0.03]");
export const btnDanger = cn(btn, "border border-red-200 bg-white text-red-700 hover:bg-red-50");
export const btnSmall = "px-3 py-1.5 text-xs";

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
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function Alert({ tone = "neutral", children }: { tone?: "neutral" | "error" | "success" | "warn"; children: ReactNode }) {
  const tones = {
    neutral: "border-black/10 bg-white text-ink-700",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-brand-100 bg-brand-50 text-brand-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 px-6 py-10 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
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

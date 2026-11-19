import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, orders, plans } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Badge, btnGhost, btnSmall } from "@/components/ui";
import { planHas } from "@/lib/plans";
import { stripeMode } from "@/lib/config";
import { StripeModeBanner } from "@/components/stripe-mode";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant } = await requireTenant();
  const plan = tenant.planId
    ? (await db.select().from(plans).where(eq(plans.id, tenant.planId)).limit(1))[0] ?? null
    : null;

  const [pendingBookings, newOrders] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.tenantId, tenant.id), eq(appointments.status, "pending"))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.status, "new"))),
  ]);
  const pending = (pendingBookings[0]?.n ?? 0) + (newOrders[0]?.n ?? 0);

  const daysLeft = tenant.trialEndsAt
    ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / 86_400_000))
    : null;

  const nav = [
    { href: "/app", label: "Resumen", show: true },
    { href: "/app/bandeja", label: "Bandeja", show: true, badge: pending },
    { href: "/app/catalogo", label: "Catálogo", show: true },
    { href: "/app/servicios", label: "Servicios", show: planHas(plan, "bookings") },
    { href: "/app/reservas", label: "Reservas", show: planHas(plan, "bookings") },
    { href: "/app/encargos", label: "Encargos", show: planHas(plan, "orders") },
    { href: "/app/qr", label: "QR", show: planHas(plan, "qr") },
    { href: "/app/ajustes", label: "Ajustes", show: true },
    { href: "/app/plan", label: "Plan", show: true },
  ].filter((i) => i.show);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/app" className="flex min-w-0 items-center gap-2">
              {tenant.logoData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/img/${tenant.id}?t=logo`} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <span
                  className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  {tenant.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight">{tenant.name}</span>
                <span className="block text-[11px] text-ink-500">{plan?.name ?? "Sin plan"}</span>
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link href={`/c/${tenant.slug}`} target="_blank" className={`${btnGhost} ${btnSmall}`}>
                Ver catálogo ↗
              </Link>
              <form action={logoutAction}>
                <button className={`${btnGhost} ${btnSmall}`}>Salir</button>
              </form>
            </div>
          </div>

          <nav className="-mx-1 mt-2 flex gap-1 overflow-x-auto pb-0.5">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 py-1.5 text-[13px] font-medium text-ink-700 hover:border-ink-950/20 hover:text-ink-950"
              >
                {item.label}
                {"badge" in item && item.badge ? (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {tenant.status === "trial" && daysLeft !== null ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs text-amber-900">
            <span>
              Estás en prueba: {daysLeft === 0 ? "termina hoy" : `quedan ${daysLeft} días`}
              {tenant.trialEndsAt ? ` (hasta ${tenant.trialEndsAt.toISOString().slice(0, 10)})` : ""}.
            </span>
            <Link href="/app/plan" className="font-semibold underline">
              Ver planes y contratar
            </Link>
          </div>
        </div>
      ) : null}

      <StripeModeBanner mode={stripeMode()} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        {user.mustChangePassword ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            <span>Estás usando la contraseña temporal.</span>
            <Link href="/cuenta/contrasena" className={`${btnGhost} ${btnSmall}`}>
              Cambiarla
            </Link>
          </div>
        ) : null}
        {children}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-2 text-center text-xs text-ink-300">
        <span className="inline-flex items-center gap-1.5">
          Funciona con
          <Badge tone="neutral">Vitrio</Badge>
        </span>
      </footer>
    </div>
  );
}

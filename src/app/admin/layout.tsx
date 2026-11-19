import Link from "next/link";
import { stripeMode } from "@/lib/config";
import { StripeModeBanner } from "@/components/stripe-mode";
import { requireSuperadmin } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { btnGhost, btnSmall } from "@/components/ui";

const nav = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/comercios", label: "Comercios" },
  { href: "/admin/planes", label: "Planes" },
  { href: "/admin/cuenta", label: "Cuenta" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperadmin();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-950 text-xs font-bold text-white">V</span>
              <span className="text-sm font-semibold">Vitrio</span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-ink-700">admin</span>
            </Link>
            <nav className="flex flex-wrap gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-black/5"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-ink-500 sm:block">{user.email}</span>
            <form action={logoutAction}>
              <button className={`${btnGhost} ${btnSmall}`}>Salir</button>
            </form>
          </div>
        </div>
      </header>
      <StripeModeBanner mode={stripeMode()} />

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}

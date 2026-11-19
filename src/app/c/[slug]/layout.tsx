import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/public";
import { planHas } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicTenant(slug);
  if (!data) notFound();
  const { tenant, plan, services } = data;

  const canReserve = tenant.bookingsEnabled && planHas(plan, "bookings");
  const canOrder = tenant.ordersEnabled && planHas(plan, "orders") && data.products.length > 0;
  const canServices = canReserve && services.length > 0;
  const wa = tenant.whatsapp?.replace(/\D/g, "");

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center gap-3">
            {tenant.logoData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/img/${tenant.id}?t=logo`} alt="" className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              <span
                className="grid h-11 w-11 place-items-center rounded-xl text-base font-bold text-white"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                {tenant.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{tenant.name}</p>
              <p className="truncate text-xs text-ink-500">
                {[tenant.address, tenant.city].filter(Boolean).join(" · ") || "Catálogo online"}
              </p>
            </div>
            {wa ? (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-black/10 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.03]"
              >
                WhatsApp
              </a>
            ) : null}
          </div>

          <nav className="mt-3 flex gap-1 overflow-x-auto">
            <Link href={`/c/${slug}`} className="whitespace-nowrap rounded-lg bg-black/5 px-3 py-1.5 text-sm font-medium">
              Catálogo
            </Link>
            {canServices ? (
              <Link
                href={`/c/${slug}/reservar`}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-black/5"
              >
                Reservar
              </Link>
            ) : canReserve ? (
              <Link
                href={`/c/${slug}/reservar`}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-black/5"
              >
                Reservar mesa
              </Link>
            ) : null}
            {canOrder ? (
              <Link
                href={`/c/${slug}/encargo`}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-black/5"
              >
                Hacer encargo
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>

      <footer className="mx-auto max-w-3xl px-4 pb-10 pt-6 text-center text-xs text-ink-300">
        <p className="mb-1">{tenant.name}</p>
        <p>Funciona con Vitrio</p>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/public";
import { planHas } from "@/lib/plans";
import { bookingLabel } from "@/lib/booking";

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
  const place = [tenant.address, tenant.city].filter(Boolean).join(" · ");

  const tabs = [
    { href: `/c/${slug}`, label: "Carta", show: true },
    {
      href: `/c/${slug}/reservar`,
      label: canServices ? "Reservar cita" : bookingLabel(tenant),
      show: canReserve,
    },
    { href: `/c/${slug}/encargo`, label: "Encargar", show: canOrder },
  ].filter((t) => t.show);

  return (
    <div className="min-h-dvh bg-paper text-ink-950">
      {/* ---------------------------- portada ---------------------------- */}
      <header className="relative">
        <div className="relative h-[260px] overflow-hidden bg-ink-900 sm:h-[380px]">
          {tenant.coverData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/img/${tenant.id}?t=cover`}
              alt=""
              className="h-full w-full object-cover opacity-90"
            />
          ) : (
            <div
              className="h-full w-full paper-grain"
              style={{ background: `linear-gradient(140deg, ${tenant.primaryColor} 0%, #14110d 78%)` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/95 via-ink-950/55 to-ink-950/25" />

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-3xl px-5 pb-6 text-ivory">
              <div className="flex items-end gap-4">
                {tenant.logoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/img/${tenant.id}?t=logo`}
                    alt=""
                    className="mb-1 h-14 w-14 flex-none rounded-full object-cover ring-1 ring-ivory/40"
                  />
                ) : (
                  <span className="serif mb-1 grid h-14 w-14 flex-none place-items-center rounded-full border border-ivory/40 text-xl">
                    {tenant.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="eyebrow-sm text-ivory/70">{place || "Catálogo online"}</p>
                  <h1 className="serif mt-1.5 text-3xl leading-none sm:text-5xl">{tenant.name}</h1>
                </div>
              </div>
              {tenant.tagline ? (
                <p className="serif mt-4 max-w-xl text-sm italic leading-relaxed text-ivory/80 sm:text-base">
                  {tenant.tagline}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* navegación */}
        <div className="sticky top-0 z-30 border-b border-ink-950/10 bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto px-4">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="eyebrow whitespace-nowrap border-b-2 border-transparent px-3 py-3.5 text-ink-500 transition hover:text-ink-950"
              >
                {tab.label}
              </Link>
            ))}
            <div className="ml-auto flex items-center gap-3">
              {tenant.phone ? (
                <a
                  href={`tel:${tenant.phone.replace(/\s/g, "")}`}
                  className="eyebrow hidden text-ink-500 hover:text-ink-950 sm:block"
                >
                  Llamar
                </a>
              ) : null}
              {wa ? (
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noreferrer"
                  className="eyebrow hidden text-brand-700 hover:text-brand-600 sm:block"
                >
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-5">{children}</main>

      <footer className="border-t border-ink-950/10 px-4 py-10 text-center">
        <p className="serif text-base">{tenant.name}</p>
        {place ? <p className="mt-1 text-xs text-ink-500">{place}</p> : null}
        {tenant.hours ? <HoursSummary hours={tenant.hours} /> : null}
        <p className="eyebrow-sm mt-6 text-ink-300">
          Hecho con{" "}
          <Link href="/" className="hover:text-brand-600">
            Vitrio
          </Link>
        </p>
      </footer>
    </div>
  );
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function HoursSummary({ hours }: { hours: Record<string, string[][]> }) {
  const rows = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    day: DAYS[d],
    ranges: (hours[String(d)] ?? []) as string[][],
  }));
  if (rows.every((r) => r.ranges.length === 0)) return null;
  return (
    <div className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-ink-500">
      {rows.map((r) => (
        <div key={r.day} className="flex justify-between gap-2">
          <span className="text-ink-700">{r.day}</span>
          <span className={r.ranges.length === 0 ? "text-ink-300" : ""}>
            {r.ranges.length === 0 ? "Cerrado" : r.ranges.map((x) => `${x[0]}–${x[1]}`).join(" ")}
          </span>
        </div>
      ))}
    </div>
  );
}

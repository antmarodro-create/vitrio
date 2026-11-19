import Link from "next/link";
import { Card, CardBody, btnGhost, btnPrimary } from "@/components/ui";
import { formatEUR } from "@/lib/money";
import { DEFAULT_PLANS, FEATURE_LABELS, FEATURE_KEYS } from "@/lib/plans";

export const metadata = { title: "Vitrio · Catálogo, reservas y encargos para tu comercio" };

const demo = "/c/bar-la-plaza";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-950 text-sm font-bold text-white">V</span>
          <span className="text-lg font-semibold tracking-tight">Vitrio</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href={demo} className={btnGhost}>
            Ver demo
          </Link>
          <Link href="/login" className={btnPrimary}>
            Entrar
          </Link>
        </nav>
      </header>

      <section className="mt-16 max-w-3xl">
        <p className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Para bares, belleza, moda y servicios
        </p>
        <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Tu comercio, con catálogo, reservas y encargos. Sin comisiones.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-500">
          Un QR en la mesa o en el escaparate y tus clientes ven la carta, reservan mesa o piden para recoger.
          Tú gestionas todo desde el móvil.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={demo} className={btnPrimary}>
            Probar el catálogo demo
          </Link>
          <Link href="/login" className={btnGhost}>
            Ya soy cliente
          </Link>
        </div>
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Catálogo con QR",
            text: "Fotos, precios y categorías. Cartel listo para imprimir y contador de escaneos.",
          },
          {
            title: "Reservas y citas",
            text: "Aforo real, horarios por tramos y bloqueo de dobles reservas en servidor.",
          },
          {
            title: "Cobro de señales",
            text: "Prepago parcial o total con tarjeta y Bizum mediante Stripe Checkout.",
          },
        ].map((f) => (
          <Card key={f.title}>
            <CardBody>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-ink-500">{f.text}</p>
            </CardBody>
          </Card>
        ))}
      </section>

      <section className="mt-20">
        <h2 className="text-2xl font-semibold tracking-tight">Planes</h2>
        <p className="mt-1 text-sm text-ink-500">Precios sin IVA. Prueba de 30 días sin tarjeta.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {DEFAULT_PLANS.map((plan) => (
            <Card key={plan.slug} className={plan.slug === "pro" ? "ring-2 ring-brand-600" : ""}>
              <CardBody>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {plan.slug === "pro" ? (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      Recomendado
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {formatEUR(plan.priceMonthlyCents)}
                  <span className="text-sm font-normal text-ink-500"> /mes</span>
                </p>
                <p className="text-xs text-ink-500">
                  o {formatEUR(plan.priceYearlyCents)} al año ({formatEUR(plan.priceYearlyCents / 12)}/mes)
                </p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {FEATURE_KEYS.map((key) => (
                    <li key={key} className={plan.features[key] ? "" : "text-ink-300"}>
                      <span className="mr-1.5">{plan.features[key] ? "✓" : "·"}</span>
                      {FEATURE_LABELS[key].label}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mt-20 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-6 text-sm text-ink-500">
        <p>© {new Date().getFullYear()} Vitrio. Producto en pruebas.</p>
        <div className="flex gap-4">
          <Link href="/legal" className="hover:text-ink-950">
            Aviso legal
          </Link>
          <Link href="/login" className="hover:text-ink-950">
            Acceso
          </Link>
        </div>
      </footer>
    </main>
  );
}

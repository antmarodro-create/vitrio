import Link from "next/link";
import { formatEUR } from "@/lib/money";
import { DEFAULT_PLANS, FEATURE_KEYS, FEATURE_LABELS } from "@/lib/plans";

export const metadata = {
  title: "Vitrio · La web de tu comercio, con reservas y encargos",
  description:
    "Catálogo con QR, reservas de mesa o cita y encargos con recogida. Los cobros van directos a tu cuenta. Sin comisiones por venta.",
};

const SHOWROOM = [
  {
    slug: "bodega-lumiere",
    label: "Restaurante · Plan Pro",
    name: "Bodega Lumière",
    text: "Carta con fotos, reserva de mesa con señal de 15 € y encargos para recoger.",
    img: "/demo/bodega-lumiere-hero.jpg",
  },
  {
    slug: "salon-ebano",
    label: "Peluquería · Plan Premium",
    name: "Salón Ébano",
    text: "Cita por servicio, señal con tarjeta o Bizum y tienda de producto.",
    img: "/demo/salon-ebano-hero.jpg",
  },
  {
    slug: "lumen-panaderia",
    label: "Obrador · Plan Básico",
    name: "Lumen Panadería",
    text: "Catálogo y QR para el mostrador. Aquí se ve lo que falta sin plan Pro.",
    img: "/demo/lumen-panaderia-hero.jpg",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink-950 paper-grain">
      {/* ------------------------------- cabecera ------------------------------- */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="serif text-2xl leading-none">Vitrio</span>
          <span className="eyebrow-sm hidden text-ink-300 sm:block">Comercio digital</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="#planes" className="eyebrow hidden text-ink-500 hover:text-ink-950 sm:block">
            Planes
          </Link>
          <Link href="/login" className="eyebrow border-b border-ink-950/40 pb-0.5 hover:border-ink-950">
            Entrar
          </Link>
        </nav>
      </header>

      {/* --------------------------------- hero -------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-6 sm:pt-14">
        <div className="grid items-end gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rise">
            <p className="eyebrow text-brand-700">Para bares, belleza, tiendas y servicios</p>
            <h1 className="serif mt-5 text-[2.6rem] leading-[1.02] tracking-tight sm:text-[4.1rem]">
              Tu escaparate,
              <br />
              tu agenda y tus
              <br />
              cobros. <span className="italic text-brand-600">Sin comisiones.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-500">
              Un QR en la mesa o en la puerta y el cliente ve tu carta, reserva mesa o pide para recoger. Tú
              confirmas desde el móvil. El dinero de tus ventas entra en <strong className="font-medium text-ink-900">tu</strong>{" "}
              cuenta de Stripe, nunca en la nuestra.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/c/bodega-lumiere"
                className="bg-ink-950 px-6 py-3.5 text-[13px] font-semibold tracking-wide text-ivory transition hover:bg-ink-900"
              >
                Entrar en la demo
              </Link>
              <Link href="/login" className="eyebrow border-b border-ink-950/40 pb-1 hover:border-ink-950">
                Ya soy cliente
              </Link>
            </div>
            <p className="mt-6 text-[11px] tracking-wide text-ink-300">
              30 días de prueba · sin tarjeta · desde {formatEUR(1900)}/mes
            </p>
          </div>

          <div className="rise rise-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/demo/bodega-lumiere-hero.jpg"
                alt="Bodega Lumière"
                className="h-[320px] w-full object-cover sm:h-[420px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-ivory">
                <div>
                  <p className="eyebrow-sm text-ivory/70">Demo en vivo</p>
                  <p className="serif mt-1 text-2xl leading-none">Bodega Lumière</p>
                </div>
                <Link
                  href="/c/bodega-lumiere"
                  className="eyebrow border-b border-ivory/50 pb-0.5 text-ivory/90 hover:border-ivory"
                >
                  Reservar mesa
                </Link>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-ink-950/10 pt-3 text-[11px] text-ink-500">
              <span>Alicante · 24 comensales</span>
              <span className="text-brand-700">● Aceptando reservas ahora</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ tres piezas ----------------------------- */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex items-baseline gap-4">
          <h2 className="serif text-2xl">Tres piezas, una sola web</h2>
          <span className="h-px flex-1 bg-ink-950/12" />
        </div>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {[
            {
              n: "01",
              t: "Escaparate",
              d: "Carta o catálogo con fotos, categorías y precios que se actualizan al momento. QR listo para imprimir y contador de escaneos.",
            },
            {
              n: "02",
              t: "Agenda",
              d: "Reservas de mesa por aforo o citas por servicio y duración, con bloqueo de dobles reservas en el servidor.",
            },
            {
              n: "03",
              t: "Cobros",
              d: "Señal o pago completo con tarjeta y Bizum en tu cuenta conectada. Reembolsos desde Stripe, sin tocar el código.",
            },
          ].map((f) => (
            <div key={f.n} className="border-t border-ink-950/15 pt-5">
              <p className="serif text-3xl text-brand-500">{f.n}</p>
              <h3 className="serif mt-3 text-xl">{f.t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------- showroom ------------------------------- */}
      <section className="border-y border-ink-950/10 bg-ivory-deep/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="eyebrow text-brand-700">Showroom</p>
          <h2 className="serif mt-4 max-w-2xl text-3xl leading-tight sm:text-4xl">
            Así se ve tu negocio cuando entra un cliente.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-500">
            Tres comercios reales de demostración, uno por plan. Entra como cliente, reserva o encarga, y luego
            mira cómo aparece en el panel del comercio.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {SHOWROOM.map((shop) => (
              <Link key={shop.slug} href={`/c/${shop.slug}`} className="group block">
                <div className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shop.img}
                    alt={shop.name}
                    className="h-56 w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 to-transparent opacity-70" />
                  <p className="absolute bottom-3 left-4 serif text-xl text-ivory">{shop.name}</p>
                </div>
                <p className="eyebrow-sm mt-3 text-brand-700">{shop.label}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{shop.text}</p>
                <span className="eyebrow-sm mt-3 inline-block border-b border-ink-950/30 pb-0.5 group-hover:border-ink-950">
                  Abrir la web
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- cómo funciona ------------------------------ */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow text-brand-700">Qué pasa cuando alguien reserva</p>
            <h2 className="serif mt-4 text-3xl leading-tight">
              Del móvil del cliente a tu bandeja, en el mismo segundo.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-500">
              Cada solicitud queda registrada con su hora. Tú confirmas con un clic desde la bandeja y el cliente
              lo ve en su página de seguimiento, sin llamadas ni WhatsApp cruzados.
            </p>
            <Link href="/c/bodega-lumiere/reservar" className="mt-6 inline-block bg-ink-950 px-6 py-3.5 text-[13px] font-semibold tracking-wide text-ivory hover:bg-ink-900">
              Probar una reserva
            </Link>
          </div>

          <ol className="space-y-5">
            {[
              { t: "El cliente elige día y hora", d: "La disponibilidad se calcula con tu aforo, tus horarios y las reservas ya confirmadas." },
              { t: "Deja nombre y teléfono", d: "Si tu plan lo permite, paga la señal con tarjeta o Bizum en tu cuenta." },
              { t: "Te llega a la bandeja", d: "Con nombre, teléfono, comensales y notas. Botón de confirmar o rechazar." },
              { t: "El cliente ve el cambio", d: "Su página de seguimiento pasa a «confirmada» con la hora exacta del movimiento." },
            ].map((step, i) => (
              <li key={step.t} className="flex gap-4 border-t border-ink-950/10 pt-4">
                <span className="serif text-lg text-brand-500">0{i + 1}</span>
                <div>
                  <p className="text-sm font-medium">{step.t}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------- planes -------------------------------- */}
      <section id="planes" className="border-t border-ink-950/10">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-brand-700">Planes</p>
              <h2 className="serif mt-3 text-3xl leading-tight sm:text-4xl">Sin comisión por venta. Nunca.</h2>
              <p className="mt-2 text-sm text-ink-500">Precios sin IVA. 30 días de prueba y factura anual con un mes gratis.</p>
            </div>
          </div>

          <div className="mt-10 grid gap-px bg-ink-950/10 sm:grid-cols-3">
            {DEFAULT_PLANS.map((plan) => {
              const highlighted = plan.slug === "pro";
              return (
                <div key={plan.slug} className={`relative p-7 ${highlighted ? "bg-ink-950 text-ivory" : "bg-paper"}`}>
                  {highlighted ? (
                    <span className="absolute right-5 top-5 eyebrow-sm rounded-full bg-brand-500 px-2.5 py-1 text-ink-950">
                      Más elegido
                    </span>
                  ) : null}
                  <h3 className="serif text-2xl">{plan.name}</h3>
                  <p className={`mt-5 serif text-4xl tabular-nums ${highlighted ? "text-ivory" : ""}`}>
                    {formatEUR(plan.priceMonthlyCents)}
                    <span className={`ml-1 text-sm ${highlighted ? "text-ivory/60" : "text-ink-500"}`}>/mes</span>
                  </p>
                  <p className={`mt-1 text-[11px] ${highlighted ? "text-ivory/50" : "text-ink-300"}`}>
                    o {formatEUR(plan.priceYearlyCents)} al año
                  </p>

                  <ul className="mt-6 space-y-2 text-[13px]">
                    {FEATURE_KEYS.map((key) => {
                      const has = plan.features[key];
                      return (
                        <li
                          key={key}
                          className={
                            has ? "" : highlighted ? "text-ivory/30 line-through" : "text-ink-300 line-through"
                          }
                        >
                          <span className={`mr-2 ${has ? "text-brand-500" : "opacity-40"}`}>{has ? "—" : "·"}</span>
                          {FEATURE_LABELS[key].label}
                        </li>
                      );
                    })}
                  </ul>

                  <Link
                    href={`/c/${plan.slug === "basico" ? "lumen-panaderia" : plan.slug === "pro" ? "bodega-lumiere" : "salon-ebano"}`}
                    className={`mt-7 block w-full py-3 text-center text-[12px] font-semibold tracking-wide ${
                      highlighted
                        ? "bg-ivory text-ink-950 hover:bg-brand-50"
                        : "border border-ink-950/20 hover:border-ink-950"
                    }`}
                  >
                    Ver este plan en vivo
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --------------------------------- cierre ------------------------------- */}
      <footer className="border-t border-ink-950/10">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-wrap items-baseline justify-between gap-6">
            <div>
              <p className="serif text-2xl">Vitrio</p>
              <p className="mt-1 text-[11px] text-ink-500">Alicante · producto en pruebas con datos ficticios</p>
            </div>
            <nav className="flex flex-wrap gap-6 text-[11px] text-ink-500">
              <Link href="/legal" className="hover:text-ink-950">
                Aviso legal y privacidad
              </Link>
              <Link href="/c/bodega-lumiere" className="hover:text-ink-950">
                Demo restaurante
              </Link>
              <Link href="/c/salon-ebano" className="hover:text-ink-950">
                Demo peluquería
              </Link>
              <Link href="/login" className="hover:text-ink-950">
                Acceso de comercios
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

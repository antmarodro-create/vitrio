import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { Alert, Badge, Card, CardBody, SectionTitle, btnBrand, btnGhost, btnSmall } from "@/components/ui";
import { planHas } from "@/lib/plans";
import { connectStatus, stripePlatformReady } from "@/lib/stripe";
import { ProfileForm, SettingsForm } from "../forms";
import { toggleModuleAction } from "../actions";
import { connectStripeAction, refreshStripeAction, unlinkStripeAction } from "../cobros-actions";

export const metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

function ToggleRow({
  title,
  description,
  active,
  module,
  disabled,
  disabledHint,
}: {
  title: string;
  description: string;
  active: boolean;
  module: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {title} <Badge tone={active ? "green" : "neutral"}>{active ? "Activo" : "Inactivo"}</Badge>
        </p>
        <p className="text-xs text-ink-500">{disabled ? disabledHint : description}</p>
      </div>
      <form action={toggleModuleAction}>
        <input type="hidden" name="module" value={module} />
        <button className={`${btnGhost} ${btnSmall}`} disabled={disabled}>
          {active ? "Desactivar" : "Activar"}
        </button>
      </form>
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { stripe: stripeParam } = await searchParams;
  const plan = tenant.planId ? (await db.select().from(plans).where(eq(plans.id, tenant.planId)).limit(1))[0] ?? null : null;

  const canBook = planHas(plan, "bookings");
  const canOrders = planHas(plan, "orders");
  const canPay = planHas(plan, "payments");
  const connect = connectStatus(tenant);
  const charging = connect === "activa";

  return (
    <div className="space-y-6">
      <SectionTitle title="Ajustes" hint="Perfil, cobros, horarios, aforo y prepago." />

      {stripeParam === "ok" ? (
        <Alert tone="success">
          Has vuelto de Stripe. Pulsa «Actualizar estado» para comprobar si tu cuenta ya puede cobrar.
        </Alert>
      ) : null}
      {stripeParam === "reintentar" ? (
        <Alert tone="warn">El alta quedó a medias. Vuelve a abrirla para terminar de enviar tus datos.</Alert>
      ) : null}
      {stripeParam === "error" ? <Alert tone="error">No hemos podido abrir el alta de Stripe. Inténtalo de nuevo.</Alert> : null}
      {stripeParam === "plan" ? (
        <Alert tone="warn">
          Los cobros online necesitan el plan Pro o superior.{" "}
          <Link href="/app/plan" className="underline">
            Ver planes
          </Link>
        </Alert>
      ) : null}
      {stripeParam === "sin-configurar" ? (
        <Alert tone="warn">La plataforma no tiene Stripe configurado todavía. Avisa al equipo de Vitrio.</Alert>
      ) : null}

      {/* ---------------------------- Stripe Connect ---------------------------- */}
      <Card className={charging ? "border-brand-100" : ""}>
        <CardBody>
          <SectionTitle
            title="Cobros: tu cuenta de Stripe"
            hint="El dinero de tus reservas y encargos va directo a tu cuenta. Vitrio no lo toca."
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/[0.03] px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                Estado:{" "}
                {connect === "activa" ? (
                  <Badge tone="green">Cobrando</Badge>
                ) : connect === "pendiente" ? (
                  <Badge tone="amber">Falta verificación</Badge>
                ) : connect === "sin_cuenta" ? (
                  <Badge tone="neutral">Sin conectar</Badge>
                ) : (
                  <Badge tone="red">Plataforma sin Stripe</Badge>
                )}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {connect === "activa"
                  ? "Ya puedes pedir señal en las reservas y cobrar encargos."
                  : connect === "pendiente"
                    ? "Has empezado el alta: Stripe necesita más datos para habilitar los cobros."
                    : "Conecta tu cuenta para cobrar señales y encargos online."}
                {tenant.stripeAccountId ? ` · ${tenant.stripeAccountId}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!charging ? (
                <form action={connectStripeAction}>
                  <button className={btnBrand}>
                    {tenant.stripeAccountId ? "Terminar el alta en Stripe" : "Conectar mi Stripe"}
                  </button>
                </form>
              ) : null}
              {tenant.stripeAccountId ? (
                <form action={refreshStripeAction}>
                  <button className={btnGhost}>Actualizar estado</button>
                </form>
              ) : null}
              {tenant.stripeAccountId ? (
                <form action={unlinkStripeAction}>
                  <button className={`${btnGhost} ${btnSmall} text-red-700`}>Desvincular</button>
                </form>
              ) : null}
            </div>
          </div>

          <p className="mt-3 text-xs text-ink-500">
            Con Stripe Connect, cada comercio cobra en su propia cuenta: las comisiones de Stripe (1,5 % + 0,25 € en
            tarjetas europeas) las asume el comercio y Vitrio no intermedia en el dinero. La cuota de Vitrio se factura
            aparte, por mensualidad o anualidad.
          </p>

          {!stripePlatformReady() ? (
            <div className="mt-3">
              <Alert tone="warn">
                Falta <code>STRIPE_SECRET_KEY</code> en el servidor. Mientras no exista, las reservas se confirman sin
                señal y los encargos se pagan en el local.
              </Alert>
            </div>
          ) : null}

          <div className="mt-4">
            <ToggleRow
              title="Cobro con tarjeta"
              description="Checkout de Stripe en la cuenta del comercio."
              active={tenant.paymentCardEnabled && charging}
              module="card"
              disabled={!canPay || !charging}
              disabledHint={!canPay ? "Tu plan no incluye cobros online." : "Conecta tu Stripe para activarlo."}
            />
            <ToggleRow
              title="Bizum"
              description="Solo EUR y entre 0,50 € y 5.000 €. Depende de que tu cuenta de Stripe lo tenga habilitado."
              active={tenant.paymentBizumEnabled && charging}
              module="bizum"
              disabled={!canPay || !charging}
              disabledHint={!canPay ? "Tu plan no incluye cobros online." : "Conecta tu Stripe para activarlo."}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle title="Módulos" hint="Puedes desactivar reservas o encargos sin perder la configuración." />
          <ToggleRow
            title="Reservas y citas"
            description="Los clientes reservan mesa o cita desde el catálogo."
            active={tenant.bookingsEnabled}
            module="bookings"
            disabled={!canBook}
            disabledHint="Tu plan no incluye reservas."
          />
          <ToggleRow
            title="Encargos"
            description="Pedidos con recogida o entrega."
            active={tenant.ordersEnabled}
            module="orders"
            disabled={!canOrders}
            disabledHint="Tu plan no incluye encargos."
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle title="Perfil del comercio" hint="Es lo que ve el cliente en el catálogo." />
          <ProfileForm tenant={tenant} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle title="Horario, aforo y prepago" hint="La disponibilidad se calcula en servidor con esta configuración." />
          <SettingsForm tenant={tenant} />
        </CardBody>
      </Card>
    </div>
  );
}

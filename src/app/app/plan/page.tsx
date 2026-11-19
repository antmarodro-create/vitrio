import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, plans, products, tenants } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { Alert, Badge, Card, CardBody, SectionTitle, btnBrand, btnGhost, btnSmall } from "@/components/ui";
import { formatEUR } from "@/lib/money";
import { FEATURE_KEYS, FEATURE_LABELS, planHas } from "@/lib/plans";
import { requestActivationAction } from "@/app/admin/actions";

export const metadata = { title: "Plan" };
export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const { tenant } = await requireTenant();
  const current = tenant.planId ? (await db.select().from(plans).where(eq(plans.id, tenant.planId)).limit(1))[0] ?? null : null;
  const available = await db.select().from(plans).where(eq(plans.active, true)).orderBy(plans.sortOrder);

  const [productCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.tenantId, tenant.id));

  const month = new Date().toISOString().slice(0, 7);
  const [bookingsCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenant.id),
        sql`to_char(${appointments.startsAt} AT TIME ZONE ${tenant.timezone}, 'YYYY-MM') = ${month}`,
      ),
    );

  const daysLeft = tenant.trialEndsAt ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / 86_400_000)) : null;

  return (
    <div className="space-y-6">
      <SectionTitle title="Tu plan" hint="Los precios no incluyen IVA (21%). Facturación anual con dos meses gratis." />

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Plan actual</p>
              <p className="text-2xl font-semibold">{current?.name ?? "Sin plan"}</p>
              <p className="text-sm text-ink-500">
                {current ? `${formatEUR(current.priceMonthlyCents)}/mes + IVA` : "Sin suscripción activa"}
                {tenant.status === "trial" && daysLeft !== null ? ` · prueba: ${daysLeft} días restantes` : ""}
              </p>
            </div>
            <Badge tone={tenant.status === "active" ? "green" : "amber"}>
              {tenant.status === "active" ? "Activa" : tenant.status === "trial" ? "En prueba" : tenant.status}
            </Badge>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl bg-black/[0.03] p-3">
              <dt className="text-xs text-ink-500">Artículos</dt>
              <dd className="font-semibold tabular-nums">
                {productCount?.n ?? 0}
                {current?.maxProducts ? ` / ${current.maxProducts}` : ""}
              </dd>
            </div>
            <div className="rounded-xl bg-black/[0.03] p-3">
              <dt className="text-xs text-ink-500">Reservas del mes</dt>
              <dd className="font-semibold tabular-nums">
                {bookingsCount?.n ?? 0}
                {current?.maxBookingsMonth ? ` / ${current.maxBookingsMonth}` : ""}
              </dd>
            </div>
            <div className="rounded-xl bg-black/[0.03] p-3">
              <dt className="text-xs text-ink-500">Reservas</dt>
              <dd className="font-semibold">{planHas(current, "bookings") ? "Incluidas" : "No incluidas"}</dd>
            </div>
            <div className="rounded-xl bg-black/[0.03] p-3">
              <dt className="text-xs text-ink-500">Cobros online</dt>
              <dd className="font-semibold">{planHas(current, "payments") ? "Incluidos" : "No incluidos"}</dd>
            </div>
          </dl>

          {tenant.activationRequested ? (
            <div className="mt-4">
              <Alert tone="success">
                Solicitud enviada. El equipo de Vitrio activará tu plan y te avisará por email.
              </Alert>
            </div>
          ) : (
            <form action={requestActivationAction} className="mt-4">
              <input type="hidden" name="tenantId" value={tenant.id} />
              <button className={btnBrand}>Contratar / solicitar activación</button>
              <p className="mt-2 text-xs text-ink-500">
                Todavía no hay cobro automático de suscripciones: la solicitud se registra y el plan se activa a mano.
              </p>
            </form>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {available.map((plan) => {
          const isCurrent = plan.id === tenant.planId;
          return (
            <Card key={plan.id} className={isCurrent ? "ring-2 ring-brand-600" : ""}>
              <CardBody>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {isCurrent ? <Badge tone="green">Tu plan</Badge> : null}
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatEUR(plan.priceMonthlyCents)}
                  <span className="text-sm font-normal text-ink-500"> /mes</span>
                </p>
                <p className="text-xs text-ink-500">
                  {formatEUR(plan.priceYearlyCents)}/año + IVA · {plan.maxProducts ? `${plan.maxProducts} artículos` : "sin límite"}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {FEATURE_KEYS.map((key) => (
                    <li key={key} className={planHas(plan, key) ? "" : "text-ink-300"}>
                      <span className="mr-1.5">{planHas(plan, key) ? "✓" : "·"}</span>
                      {FEATURE_LABELS[key].label}
                    </li>
                  ))}
                </ul>
                {!isCurrent ? (
                  <form action={requestActivationAction} className="mt-4">
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <button className={`${btnGhost} ${btnSmall}`}>Quiero este plan</button>
                  </form>
                ) : null}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-ink-500">
        Al vencer la prueba, la cuenta se congela 14 días y después se eliminan los datos (RGPD).{" "}
        {tenant.deleteAt ? `Fecha de borrado prevista: ${tenant.deleteAt.toISOString().slice(0, 10)}.` : ""}
      </p>
    </div>
  );
}

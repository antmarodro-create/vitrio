import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, orders, plans, products, tenants, users } from "@/db/schema";
import {
  Badge,
  Card,
  CardBody,
  SectionTitle,
  btnDanger,
  btnGhost,
  btnSmall,
  statusLabel,
  statusTone,
} from "@/components/ui";
import { businessTypeLabel } from "@/lib/plans";
import { formatDateTime } from "@/lib/time";
import { formatEUR } from "@/lib/money";
import { extendTrialAction, impersonateTenantAction, setTenantStatusAction } from "../../actions";
import { DeleteTenantForm, ResetPasswordForm, TenantEditForm } from "../../forms";

export const dynamic = "force-dynamic";
const TZ = "Europe/Madrid";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rows = await db
    .select({ tenant: tenants, plan: plans })
    .from(tenants)
    .leftJoin(plans, eq(plans.id, tenants.planId))
    .where(eq(tenants.id, id))
    .limit(1);
  if (!rows[0]) notFound();
  const { tenant, plan } = rows[0];

  const planRows = await db.select().from(plans).orderBy(plans.sortOrder);
  const [owner] = await db.select().from(users).where(eq(users.tenantId, id)).limit(1);
  const [stats] = await db
    .select({
      products: sql<number>`(select count(*)::int from ${products} where ${products.tenantId} = ${id})`,
      bookings: sql<number>`(select count(*)::int from ${appointments} where ${appointments.tenantId} = ${id})`,
      orders: sql<number>`(select count(*)::int from ${orders} where ${orders.tenantId} = ${id})`,
    })
    .from(tenants)
    .where(eq(tenants.id, id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/comercios" className="text-xs text-ink-500 hover:text-ink-950">
            ← Comercios
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {tenant.name}
            <Badge tone={statusTone[tenant.status] ?? "neutral"}>{statusLabel[tenant.status] ?? tenant.status}</Badge>
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {businessTypeLabel(tenant.businessType)} · /c/{tenant.slug} · {tenant.city ?? "sin ciudad"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/c/${tenant.slug}`} target="_blank" className={btnGhost}>
            Ver catálogo
          </Link>
          {owner ? (
            <form action={impersonateTenantAction}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <button className={`${btnGhost} ${btnSmall}`}>Entrar como comercio</button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <SectionTitle title="Ficha del comercio" hint="Datos de contacto y plan." />
            <TenantEditForm tenant={tenant} plans={planRows} />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <SectionTitle title="Estado y fechas" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Plan</dt>
                  <dd className="font-medium">
                    {plan ? `${plan.name} · ${formatEUR(plan.priceMonthlyCents)}/mes` : "Sin plan"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Prueba termina</dt>
                  <dd>{tenant.trialEndsAt ? formatDateTime(tenant.trialEndsAt, TZ) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Congelado desde</dt>
                  <dd>{tenant.frozenAt ? formatDateTime(tenant.frozenAt, TZ) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Borrado previsto</dt>
                  <dd>{tenant.deleteAt ? formatDateTime(tenant.deleteAt, TZ) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Titular</dt>
                  <dd className="truncate text-right">{owner?.email ?? "sin usuario"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Stripe del comercio</dt>
                  <dd className="truncate text-right">
                    {tenant.stripeAccountId ? (
                      <span title={tenant.stripeAccountId}>
                        {tenant.stripeChargesEnabled ? "Cobrando" : "Alta pendiente"}
                      </span>
                    ) : (
                      "Sin conectar"
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {tenant.status !== "active" ? (
                  <form action={setTenantStatusAction}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input type="hidden" name="status" value="active" />
                    <button className={btnGhost} disabled={tenant.status === "deleted"}>
                      Activar plan
                    </button>
                  </form>
                ) : null}
                {tenant.status === "active" || tenant.status === "trial" ? (
                  <form action={setTenantStatusAction}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input type="hidden" name="status" value="frozen" />
                    <button className={btnGhost}>Congelar</button>
                  </form>
                ) : null}
                {tenant.status === "frozen" ? (
                  <form action={setTenantStatusAction}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input type="hidden" name="status" value="trial" />
                    <button className={btnGhost}>Volver a prueba 30 días</button>
                  </form>
                ) : null}
              </div>

              <form action={extendTrialAction} className="mt-3 flex items-end gap-2">
                <input type="hidden" name="tenantId" value={tenant.id} />
                <label className="text-xs text-ink-500">
                  Ampliar prueba
                  <input
                    name="days"
                    type="number"
                    min={1}
                    max={90}
                    defaultValue={15}
                    className="ml-2 w-16 rounded-lg border border-black/10 px-2 py-1 text-sm"
                  />
                </label>
                <button className={`${btnGhost} ${btnSmall}`}>Añadir días</button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionTitle title="Uso" />
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-black/[0.03] py-2">
                  <p className="text-lg font-semibold tabular-nums">{stats?.products ?? 0}</p>
                  <p className="text-xs text-ink-500">productos</p>
                </div>
                <div className="rounded-xl bg-black/[0.03] py-2">
                  <p className="text-lg font-semibold tabular-nums">{stats?.bookings ?? 0}</p>
                  <p className="text-xs text-ink-500">reservas</p>
                </div>
                <div className="rounded-xl bg-black/[0.03] py-2">
                  <p className="text-lg font-semibold tabular-nums">{stats?.orders ?? 0}</p>
                  <p className="text-xs text-ink-500">encargos</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionTitle title="Acceso del titular" />
              <ResetPasswordForm tenantId={tenant.id} />
            </CardBody>
          </Card>

          <Card className="border-red-200">
            <CardBody>
              <SectionTitle title="Zona peligrosa" hint="Borrado RGPD inmediato y anonimizado de la ficha." />
              <DeleteTenantForm tenantId={tenant.id} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

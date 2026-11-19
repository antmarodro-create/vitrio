import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, tenants } from "@/db/schema";
import { Badge, Card, CardBody, Empty, SectionTitle, btnGhost, btnPrimary, btnSmall, statusLabel, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { businessTypeLabel } from "@/lib/plans";

export const metadata = { title: "Comercios" };
export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const rows = await db
    .select({ tenant: tenants, plan: plans })
    .from(tenants)
    .leftJoin(plans, eq(plans.id, tenants.planId))
    .orderBy(desc(tenants.createdAt));

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Comercios"
        hint="Las altas las hace el superadmin. No hay registro público."
        action={
          <Link href="/admin/comercios/nuevo" className={btnPrimary}>
            Nuevo comercio
          </Link>
        }
      />

      {rows.length === 0 ? (
        <Empty title="Sin comercios" hint="Crea el primero con el botón de arriba." />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-3">Comercio</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Alta</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {rows.map(({ tenant, plan }) => (
                    <tr key={tenant.id} className="hover:bg-black/[0.02]">
                      <td className="px-4 py-3">
                        <Link href={`/admin/comercios/${tenant.id}`} className="font-medium hover:underline">
                          {tenant.name}
                        </Link>
                        <p className="text-xs text-ink-500">/c/{tenant.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{businessTypeLabel(tenant.businessType)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone[tenant.status] ?? "neutral"}>
                          {statusLabel[tenant.status] ?? tenant.status}
                        </Badge>
                        {tenant.activationRequested ? (
                          <span className="ml-2 text-xs font-medium text-amber-700">pide activar</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-ink-700">{plan?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-ink-500">{formatDateTime(tenant.createdAt, "Europe/Madrid")}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/c/${tenant.slug}`} className={`${btnGhost} ${btnSmall}`} target="_blank">
                            Catálogo
                          </Link>
                          <Link href={`/admin/comercios/${tenant.id}`} className={`${btnGhost} ${btnSmall}`}>
                            Ficha
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

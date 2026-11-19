import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { plans, products, tenants, type Plan, type Product, type Tenant } from "@/db/schema";
import { maybeRunLifecycle } from "./lifecycle";

export type PublicTenant = {
  tenant: Tenant;
  plan: Plan | null;
  products: Product[];
  services: Product[];
};

export async function getTenantById(id: string): Promise<Tenant | null> {
  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  const tenant = rows[0];
  if (!tenant || tenant.status === "frozen" || tenant.status === "deleted") return null;
  return tenant;
}

/**
 * Carga un comercio para el catalogo publico. Un comercio congelado o borrado
 * no se muestra: el estado se valida siempre en servidor.
 */
export async function getPublicTenant(slug: string): Promise<PublicTenant | null> {
  await maybeRunLifecycle();

  const rows = await db
    .select({ tenant: tenants, plan: plans })
    .from(tenants)
    .leftJoin(plans, eq(plans.id, tenants.planId))
    .where(eq(tenants.slug, slug))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  const { tenant, plan } = row;
  if (tenant.status === "frozen" || tenant.status === "deleted") return null;

  const all = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenant.id), eq(products.visible, true)))
    .orderBy(asc(products.sortOrder), asc(products.name));

  return {
    tenant,
    plan,
    products: all.filter((p) => p.kind === "product"),
    services: all.filter((p) => p.kind === "service"),
  };
}

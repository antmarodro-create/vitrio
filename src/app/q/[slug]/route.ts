import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, tenants } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Enlace del QR: cuenta el escaneo y redirige al catalogo. */
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const rows = await db.select({ id: tenants.id, status: tenants.status }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  const tenant = rows[0];
  if (!tenant || tenant.status === "deleted") redirect("/");

  await db.insert(events).values({ tenantId: tenant.id, type: "qr_scan", meta: { ref: "qr" } }).catch(() => {});
  redirect(`/c/${slug}`);
}

import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { plans } from "@/db/schema";
import { DEFAULT_PLANS } from "./plans";

/**
 * Crea los planes por defecto si la tabla esta vacia. Se llama desde /setup
 * para que una instalacion nueva quede operativa sin lanzar scripts.
 */
export async function ensureDefaultPlans(): Promise<void> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(plans);
  if (n > 0) return;
  await db.insert(plans).values(DEFAULT_PLANS);
}

export async function planBySlug(slug: string) {
  const rows = await db.select().from(plans).where(eq(plans.slug, slug)).limit(1);
  return rows[0] ?? null;
}

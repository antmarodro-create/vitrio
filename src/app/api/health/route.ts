import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Healthcheck para plataformas de despliegue (Railway, Render, Docker). */
export async function GET() {
  try {
    const start = Date.now();
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - start,
      version: process.env.npm_package_version ?? "1.0.0",
      uptime: Math.round(process.uptime()),
    });
  } catch (err) {
    return Response.json({ ok: false, db: "down", error: String(err) }, { status: 503 });
  }
}

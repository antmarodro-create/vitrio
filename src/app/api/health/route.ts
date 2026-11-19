import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Resumen de la configuracion de base de datos SIN filtrar la contrasena:
 * sirve para saber si la variable llega, a que host apunta y con que TLS.
 */
function dbTarget(raw: string | undefined) {
  if (!raw) return { configured: false };
  const looksQuoted = /^["']|["']$/.test(raw.trim());
  try {
    const url = new URL(raw);
    return {
      configured: true,
      host: url.hostname,
      port: url.port || "5432",
      database: url.pathname.replace(/^\//, "") || "(vacia)",
      userKind: url.username.includes(".") ? "pooler" : "directo",
      sslmode: url.searchParams.get("sslmode") ?? "(ninguno)",
      passwordLength: url.password.length,
      looksQuoted,
    };
  } catch {
    return { configured: true, invalidUrl: true, length: raw.length, looksQuoted };
  }
}

function cause(err: unknown): string | undefined {
  const c = (err as { cause?: { message?: string; code?: string } }).cause;
  if (!c) return undefined;
  return [c.code, c.message].filter(Boolean).join(" ");
}

/** Healthcheck para plataformas de despliegue (Netlify, Railway, Render, Docker). */
export async function GET() {
  const target = dbTarget(process.env.DATABASE_URL);
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - started,
      dbTarget: target,
      version: process.env.npm_package_version ?? "1.0.0",
      uptime: Math.round(process.uptime()),
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        db: "down",
        error: err instanceof Error ? err.message : String(err),
        cause: cause(err),
        dbTarget: target,
        env: {
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "(falta)",
          CRON_SECRET: process.env.CRON_SECRET ? "definida" : "(falta)",
          PG_POOL_MAX: process.env.PG_POOL_MAX ?? "(por defecto)",
        },
      },
      { status: 503 },
    );
  }
}

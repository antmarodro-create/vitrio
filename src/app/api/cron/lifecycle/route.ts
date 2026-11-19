import { timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";
import { runLifecycle } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";

/**
 * Cron diario: trial -> congelado -> borrado RGPD, avisos y caducados.
 * Protegido con CRON_SECRET (cabecera `x-cron-secret` o `?secret=`).
 * En Vercel: "0 4 * * *". En Railway/Render: cron job con curl.
 */
/** Comparacion en tiempo constante (evita filtrar el secreto por tiempos). */
function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provided = request.headers.get("x-cron-secret") ?? url.searchParams.get("secret") ?? "";
  // Falla CERADO: sin CRON_SECRET configurado, en produccion se rechaza siempre.
  // Si no, olvidar la variable dejaria el borrado de comercios abierto a cualquiera.
  const isDev = process.env.NODE_ENV !== "production";
  const authorized = config.cronSecret ? sameSecret(provided, config.cronSecret) : isDev;

  if (!authorized) {
    return Response.json(
      { ok: false, error: config.cronSecret ? "no autorizado" : "CRON_SECRET no configurado" },
      { status: 401 },
    );
  }

  try {
    const report = await runLifecycle(new Date());
    return Response.json({ ok: true, report });
  } catch (err) {
    console.error("[cron] error", err);
    return Response.json({ ok: false, error: "error interno" }, { status: 500 });
  }
}

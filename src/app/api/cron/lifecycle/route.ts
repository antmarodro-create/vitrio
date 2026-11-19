import { config } from "@/lib/config";
import { runLifecycle } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";

/**
 * Cron diario: trial -> congelado -> borrado RGPD, avisos y caducados.
 * Protegido con CRON_SECRET (cabecera `x-cron-secret` o `?secret=`).
 * En Vercel: "0 4 * * *". En Railway/Render: cron job con curl.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const provided = request.headers.get("x-cron-secret") ?? url.searchParams.get("secret") ?? "";
  const authorized = config.cronSecret ? provided === config.cronSecret : true;

  if (!authorized) {
    return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }

  try {
    const report = await runLifecycle(new Date());
    return Response.json({ ok: true, report });
  } catch (err) {
    console.error("[cron] error", err);
    return Response.json({ ok: false, error: "error interno" }, { status: 500 });
  }
}

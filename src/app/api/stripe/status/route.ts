import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenants } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { stripeMode } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Estado de la integración de Stripe, para comprobar el despliegue sin exponer
 * ninguna clave. Protegido con CRON_SECRET:
 *
 *   /api/stripe/status?key=<CRON_SECRET>
 *   o cabecera: Authorization: Bearer <CRON_SECRET>
 *
 * No modifica nada: solo consulta la cuenta de la plataforma y las cuentas
 * conectadas de cada comercio.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const given =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || url.searchParams.get("key");
  if (!secret || given !== secret) {
    return Response.json({ ok: false, error: "no autorizado: falta CRON_SECRET o no coincide" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return Response.json({
      ok: false,
      platform: { clave: "falta STRIPE_SECRET_KEY" },
      siguiente: "Pega la clave secreta de Stripe en las variables de entorno de Netlify y redespliega.",
    });
  }

  const mode = stripeMode();
  const webhookSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const out: Record<string, unknown> = {
    ok: true,
    modo: mode === "live" ? "LIVE (cobros reales)" : mode === "test" ? "test (dinero ficticio)" : "desconocido",
    webhookSecret: webhookSecret ? "configurado" : "FALTA STRIPE_WEBHOOK_SECRET",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "(falta)",
    connect: "desconocido" as string,
    cuentasConectadas: [] as unknown[],
    comercios: [] as unknown[],
  };

  // 1. ¿La clave es válida y en qué modo trabaja?
  try {
    const balance = await stripe.balance.retrieve();
    out.cuentaPlataforma = {
      moneda: balance.available[0]?.currency ?? "?",
      livemode: balance.livemode,
      claveValida: true,
    };
  } catch (err) {
    out.connect = `clave rechazada: ${err instanceof Error ? err.message : String(err)}`;
    return Response.json(out, { status: 200 });
  }

  // 2. ¿Connect funciona? Cuentas conectadas (Express) de la plataforma.
  try {
    const list = await stripe.accounts.list({ limit: 10 });
    out.connect = "activo";
    out.cuentasConectadas = list.data.map((a) => ({
      id: a.id,
      tipo: (a as { type?: string }).type ?? "?",
      cobrosHabilitados: a.charges_enabled,
      datosEnviados: a.details_submitted,
      pais: a.country,
    }));
  } catch (err) {
    out.connect = `error de Connect: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 3. Qué comercios tienen cuenta vinculada y si pueden cobrar.
  try {
    const rows = await db
      .select({
        slug: tenants.slug,
        plan: tenants.planId,
        cuenta: tenants.stripeAccountId,
        cobra: tenants.stripeChargesEnabled,
        datos: tenants.stripeDetailsSubmitted,
        señal: tenants.depositCents,
        tarjeta: tenants.paymentCardEnabled,
        bizum: tenants.paymentBizumEnabled,
        prepago: tenants.prepay,
      })
      .from(tenants)
      .where(eq(tenants.status, "active"));
    out.comercios = rows;
  } catch (err) {
    out.comercios = [`error: ${err instanceof Error ? err.message : String(err)}`];
  }

  return Response.json(out);
}

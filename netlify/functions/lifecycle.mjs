/**
 * Funcion programada de Netlify (cron diario a las 04:00 UTC).
 * Llama al endpoint protegido /api/cron/lifecycle, que es el que contiene la
 * logica (trial -> congelado -> borrado RGPD, avisos y caducados).
 *
 * Necesita las variables CRON_SECRET y URL (esta ultima la pone Netlify sola).
 */
export const config = { schedule: "0 4 * * *" };
export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET ?? "";

  const response = await fetch(`${base}/api/cron/lifecycle`, {
    headers: secret ? { "x-cron-secret": secret } : {},
  });

  const body = await response.text();
  console.log(`[lifecycle] ${response.status} ${body.slice(0, 500)}`);

  return new Response(body, {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
};

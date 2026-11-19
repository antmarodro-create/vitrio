/** Configuracion central leida del entorno. Sin secretos hardcodeados. */

function clean(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

export const config = {
  databaseUrl: clean(process.env.DATABASE_URL) ?? "",
  appUrl: (clean(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000").replace(/\/+$/, ""),
  adminEmail: (clean(process.env.ADMIN_EMAIL) ?? "admin@vitrio.app").toLowerCase(),
  adminPassword: clean(process.env.ADMIN_PASSWORD),
  timeZone: clean(process.env.BUSINESS_TIME_ZONE) ?? "Europe/Madrid",
  cronSecret: clean(process.env.CRON_SECRET),
  resendKey: clean(process.env.RESEND_API_KEY),
  emailFrom: clean(process.env.EMAIL_FROM) ?? "Vitrio <no-reply@vitrio.app>",
  stripeSecret: clean(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: clean(process.env.STRIPE_WEBHOOK_SECRET),
  seedDemo: (clean(process.env.SEED_DEMO) ?? "true") === "true",
  isProd: process.env.NODE_ENV === "production",
};

export function publicUrl(path = ""): string {
  if (!path) return config.appUrl;
  return `${config.appUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** La app solo cobra si hay Stripe configurado. */
export function stripeEnabled(): boolean {
  return Boolean(config.stripeSecret && config.stripeWebhookSecret);
}

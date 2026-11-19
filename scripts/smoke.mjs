#!/usr/bin/env node
/**
 * Test de humo post-despliegue. No escribe datos: solo comprueba que el sitio
 * responde, que la base de datos contesta y que las rutas protegidas siguen cerradas.
 *
 *   npm run smoke -- https://tu-sitio.netlify.app
 *   npm run smoke -- https://tu-sitio.netlify.app --slug bar-la-plaza
 *   SMOKE_SECRET=... npm run smoke -- https://tu-sitio.netlify.app   (prueba tambien el cron)
 *
 * Sale con codigo 1 si alguna comprobacion falla.
 */
const args = process.argv.slice(2);
const flags = new Map(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v = "true"] = a.replace(/^--/, "").split("=");
      return [k, v];
    }),
);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? process.env.SMOKE_URL ?? "").replace(/\/+$/, "");
const slug = flags.get("slug");
const secret = process.env.SMOKE_SECRET ?? flags.get("secret");

if (!base) {
  console.error("Uso: npm run smoke -- https://tu-sitio.netlify.app [--slug=mi-comercio]");
  process.exit(2);
}

const isLocal = /localhost|127\.0\.0\.1/.test(base);
const results = [];
let failures = 0;

const T = { ok: "\x1b[32m✓\x1b[0m", bad: "\x1b[31m✗\x1b[0m", warn: "\x1b[33m!\x1b[0m", dim: "\x1b[2m" };

function record(status, label, detail) {
  if (status === "bad") failures++;
  results.push({ status, label, detail });
}

async function hit(path, init) {
  const started = Date.now();
  try {
    const res = await fetch(base + path, { redirect: "manual", ...init });
    const body = await res.text();
    return { res, body, ms: Date.now() - started, error: null };
  } catch (err) {
    return { res: null, body: "", ms: Date.now() - started, error: err };
  }
}

/** Comprueba que una URL privada rebota al login en lugar de servir contenido. */
async function expectRedirect(path, label) {
  const { res, error, ms } = await hit(path);
  if (error) return record("bad", label, `sin respuesta (${error.message})`);
  const location = res.headers.get("location") ?? "";
  if ([301, 302, 303, 307, 308].includes(res.status) && /\/login/.test(location)) {
    return record("ok", label, `${res.status} → /login ${T.dim}${ms} ms${T.dim}`);
  }
  record("bad", label, `esperaba redirección a /login y llegó ${res.status}`);
}

async function main() {
  console.log(`\nTest de humo sobre ${base}\n`);

  // 1. Salud y base de datos
  const health = await hit("/api/health");
  if (health.error) {
    record("bad", "API de salud", `no responde (${health.error.message})`);
  } else if (health.res.status === 200) {
    let json = {};
    try {
      json = JSON.parse(health.body);
    } catch {}
    if (json.ok && json.db === "up") {
      record("ok", "API de salud", `base de datos OK · ${json.latencyMs} ms de consulta · ${health.ms} ms total`);
      if (json.latencyMs > 1500) {
        record("warn", "Latencia de la base de datos", `${json.latencyMs} ms: revisa región del pooler y PG_POOL_MAX`);
      }
    } else {
      record("bad", "API de salud", `responde pero la base de datos está caída: ${health.body.slice(0, 160)}`);
    }
  } else if (health.res.status === 503) {
    record("bad", "API de salud", `la app vive pero no llega a la base de datos: ${health.body.slice(0, 200)}`);
  } else {
    record("bad", "API de salud", `código inesperado ${health.res.status}`);
  }

  // 2. Páginas públicas
  for (const [path, label, needle] of [
    ["/", "Portada", null],
    ["/login", "Login", null],
    ["/legal", "Aviso legal", null],
    ["/manifest.webmanifest", "Manifest PWA", "name"],
  ]) {
    const r = await hit(path);
    if (r.error) record("bad", label, `no responde (${r.error.message})`);
    else if (r.res.status !== 200) record("bad", label, `HTTP ${r.res.status}`);
    else if (needle && !r.body.includes(needle)) record("warn", label, "responde 200 pero el contenido no parece el esperado");
    else record("ok", label, `200 · ${r.ms} ms`);
  }

  // 3. Estado de la instalación (/setup existe solo sin usuarios)
  const setup = await hit("/setup");
  if (setup.error) {
    record("bad", "Estado de /setup", `no responde (${setup.error.message})`);
  } else if (setup.res.status === 200 && setup.body.includes("administración")) {
    record("warn", "Estado de /setup", "todavía no hay superadmin: entra y crea tu cuenta");
  } else if ([307, 308, 302].includes(setup.res.status)) {
    record("ok", "Estado de /setup", "ya configurado (redirige a /login)");
  } else {
    record("bad", "Estado de /setup", `código inesperado ${setup.res.status}`);
  }

  // 4. Rutas privadas: deben rebotar al login
  await expectRedirect("/admin", "Admin sin sesión");
  await expectRedirect("/app", "Panel del comercio sin sesión");

  // 5. El cron falla cerrado
  const cron = await hit("/api/cron/lifecycle");
  if (!cron.error && [401, 403].includes(cron.res.status)) {
    record("ok", "Cron protegido", `${cron.res.status}: sin secreto no se ejecuta`);
  } else if (!cron.error && cron.res.status === 200) {
    record("bad", "Cron protegido", "RESPONDE 200 SIN SECRETO: falta CRON_SECRET en Netlify");
  } else if (cron.error) {
    record("bad", "Cron protegido", `no responde (${cron.error.message})`);
  } else {
    record("warn", "Cron protegido", `código ${cron.res.status}`);
  }

  if (secret) {
    const authed = await hit("/api/cron/lifecycle", { headers: { "x-cron-secret": secret } });
    if (!authed.error && authed.res.status === 200) {
      record("ok", "Cron con secreto", `ejecuta: ${authed.body.slice(0, 120)}`);
    } else {
      record("bad", "Cron con secreto", `rechazado: HTTP ${authed.res?.status ?? "sin respuesta"}`);
    }
  } else {
    record("warn", "Cron con secreto", "omitido: define SMOKE_SECRET para probarlo");
  }

  // 6. Webhook de Stripe: sin firma debe rechazar
  const hook = await hit("/api/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!hook.error && [400, 401, 403].includes(hook.res.status)) {
    record("ok", "Webhook de Stripe", `${hook.res.status}: rechaza peticiones sin firma`);
  } else if (!hook.error && hook.res.status === 200) {
    record("bad", "Webhook de Stripe", "acepta peticiones sin firma: revisa STRIPE_WEBHOOK_SECRET");
  } else if (!hook.error && hook.res.status === 503) {
    record("warn", "Webhook de Stripe", "sin STRIPE_WEBHOOK_SECRET todavía: normal hasta que configures Stripe");
  } else if (hook.error) {
    record("bad", "Webhook de Stripe", `no responde (${hook.error.message})`);
  } else {
    record("warn", "Webhook de Stripe", `código ${hook.res.status}`);
  }

  // 7. Comercio concreto (opcional)
  if (slug) {
    const shop = await hit(`/c/${slug}`);
    const qr = await hit(`/api/qr/${slug}`);
    if (!shop.error && shop.res.status === 200) record("ok", `Comercio /c/${slug}`, `200 · ${shop.ms} ms`);
    else record("bad", `Comercio /c/${slug}`, `HTTP ${shop.res?.status ?? "sin respuesta"}`);
    if (!qr.error && qr.res.status === 200 && (qr.res.headers.get("content-type") ?? "").includes("image"))
      record("ok", `QR de ${slug}`, "imagen generada");
    else record("bad", `QR de ${slug}`, `HTTP ${qr.res?.status ?? "sin respuesta"}`);
  }

  // 8. HTTPS y cabeceras
  if (!isLocal) {
    if (base.startsWith("https://")) record("ok", "HTTPS", "el sitio se sirve por TLS");
    else record("bad", "HTTPS", "el sitio no usa https");
  }
  const home = await hit("/");
  if (home.res) {
    if (home.res.headers.get("x-powered-by")) record("warn", "Cabecera X-Powered-By", "expuesta (¿se desplegó el next.config.ts actual?)");
    else record("ok", "Cabecera X-Powered-By", "oculta");
    const csp = home.res.headers.get("content-security-policy");
    if (csp) record("ok", "Cabecera CSP", "presente");
    else record("warn", "Cabecera CSP", "no configurada: endurecimiento opcional antes de abrir al público");
  }

  // Informe
  console.log();
  for (const r of results) {
    const icon = r.status === "ok" ? T.ok : r.status === "bad" ? T.bad : T.warn;
    console.log(`${icon} ${r.label}${r.detail ? T.dim + " — " + T.dim + r.detail + T.dim : ""}`);
  }
  const ok = results.filter((r) => r.status === "ok").length;
  const warns = results.filter((r) => r.status === "warn").length;
  console.log(
    `\n${failures === 0 ? "\x1b[32m" : "\x1b[31m"}${ok} correctas, ${warns} avisos, ${failures} fallos\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();

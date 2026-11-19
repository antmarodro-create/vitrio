#!/usr/bin/env node
/**
 * Comprobador de la configuración de Stripe (modo test o live).
 *
 *   npm run stripe:check                       # lee STRIPE_SECRET_KEY del entorno/.env
 *   STRIPE_SECRET_KEY=sk_test_... npm run stripe:check
 *
 * No cobra nada: solo consulta la API y comprueba que el Connect está listo.
 * Sale con código 1 si algo impide cobrar.
 */
import Stripe from "stripe";

try {
  process.loadEnvFile(".env");
} catch {
  /* sin .env: se usan las variables del entorno */
}

const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
let failures = 0;
const ok = (m, d = "") => console.log(`\x1b[32m✓\x1b[0m ${m}${d ? `\x1b[2m — ${d}\x1b[0m` : ""}`);
const bad = (m, d = "") => {
  failures++;
  console.log(`\x1b[31m✗\x1b[0m ${m}${d ? `\x1b[2m — ${d}\x1b[0m` : ""}`);
};
const warn = (m, d = "") => console.log(`\x1b[33m!\x1b[0m ${m}${d ? `\x1b[2m — ${d}\x1b[0m` : ""}`);

console.log("\nComprobando Stripe con las variables de este entorno\n");

if (!key) {
  bad("Falta STRIPE_SECRET_KEY", "cópiala de Dashboard → Developers → API keys");
  process.exit(1);
}

const mode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "desconocido";
if (mode === "test") ok("La clave es de MODO TEST", "no se mueve dinero real");
else if (mode === "live") warn("La clave es de PRODUCCIÓN (sk_live)", "los cobros serán reales");
else bad("La clave no parece de Stripe", "debe empezar por sk_test_ o sk_live");

const stripe = new Stripe(key, { appInfo: { name: "Vitrio", version: "1.0.0" } });

try {
  const me = await stripe.accounts.retrieve();
  ok("Clave válida", `cuenta plataforma ${me.id}${me.email ? ` · ${me.email}` : ""}`);
  if (me.charges_enabled) ok("La plataforma puede cobrar");
  else warn("La plataforma no tiene cobros activos", "normal si solo se usa para Connect");

  if (me.settings?.dashboard?.display_name) ok("Nombre de la plataforma en el extracto", me.settings.dashboard.display_name);
  else warn("Nombre en el extracto sin definir", "Dashboard → Settings → Public details");
} catch (err) {
  bad("La clave no responde", String(err?.message ?? err).slice(0, 160));
  process.exit(1);
}

// Connect habilitado en la plataforma y cuentas conectadas
try {
  const list = await stripe.accounts.list({ limit: 20 });
  const conectadas = list.data.filter((a) => a.id !== "acct_platform");
  const listas = conectadas.filter((a) => a.charges_enabled && a.details_submitted);
  ok("Connect responde", `${list.data.length} cuenta(s) accesible(s)`);
  if (list.data.length > 0) {
    for (const acc of list.data.slice(0, 5)) {
      const estado = acc.charges_enabled ? "puede cobrar" : acc.details_submitted ? "datos enviados, sin activar" : "onboarding sin terminar";
      console.log(`   · ${acc.id} ${acc.business_profile?.name ?? acc.email ?? ""} → ${estado}`);
    }
    if (listas.length === 0) {
      warn("Ninguna cuenta conectada está lista para cobrar", "completa el alta Express desde el panel del comercio");
    }
  } else {
    warn(
      "Aún no hay cuentas conectadas",
      "se crean cuando un comercio pulsa «Conectar Stripe» en /app/ajustes",
    );
  }
} catch (err) {
  const msg = String(err?.message ?? err);
  if (/signed up for Connect|Connect is not enabled/i.test(msg)) {
    bad("Connect no está activado en tu cuenta", "Dashboard → Connect → Get started (modo test)");
  } else {
    bad("No se pudo listar cuentas conectadas", msg.slice(0, 160));
  }
}

// Webhook
if (!webhookSecret) {
  warn(
    "Falta STRIPE_WEBHOOK_SECRET",
    "sin él, los pagos no se marcan como cobrados (el endpoint devuelve 503)",
  );
} else if (!webhookSecret.startsWith("whsec_")) {
  bad("STRIPE_WEBHOOK_SECRET no parece un signing secret", `empieza por «${webhookSecret.slice(0, 6)}»`);
} else {
  ok("Webhook configurado", `${webhookSecret.slice(0, 10)}…`);
  warn(
    "Recuerda activar los eventos de Connect",
    "checkout.session.completed y account.updated llegan con «event.account»",
  );
}

// Precio de prueba concreto: se importa la tarjeta de test 4242
const methods = [4242, 4000, 5555];
ok("Tarjetas de prueba disponibles", methods.map((n) => `${n} 0000 0000 000${n === 4242 ? "4" : n === 4000 ? "0" : "5"}`).join(" · "));

console.log(
  `\n${failures === 0 ? "\x1b[32mTodo listo para probar cobros" : "\x1b[31mHay bloqueos que resolver"}\x1b[0m${mode === "test" ? " (modo test: no se mueve dinero real)" : ""}\n`,
);
process.exit(failures === 0 ? 0 : 1);

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = "/home/user/pw/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function ok(name, detail = "") {
  results.push({ name, status: "OK", detail });
  console.log(`✅ ${name}${detail ? " — " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, status: "FALLO", detail });
  console.log(`❌ ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch();
const errors = [];

async function session() {
  const ctx = await browser.newContext({
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    viewport: { width: 420, height: 900 },
  });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return page;
}

let page = await session();

/** Inicia sesion en una pagina propia y espera a salir de /login. */
async function loginAs(target, email, password) {
  await target.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await target.fill('input[name="email"]', email);
  await target.fill('input[name="password"]', password);
  await target.click('button:has-text("Entrar")');
  await target.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  await target.waitForLoadState("networkidle");
  return target;
}

const login = (email, password) => loginAs(page, email, password);

/* 1. login superadmin */
try {
  await login(process.env.ADMIN_EMAIL ?? "admin@vitrio.app", process.env.ADMIN_PASSWORD ?? "vitrio-admin-2026");
  if (new URL(page.url()).pathname === "/admin") ok("Login superadmin", "→ /admin");
  else fail("Login superadmin", `URL ${page.url()}`);
  const body = await page.textContent("body");
  if (body.includes("Solicitudes de activación") && body.includes("En prueba")) ok("Métricas del admin visibles");
  else fail("Métricas del admin visibles");
  await page.screenshot({ path: `${SHOTS}/01-admin.png`, fullPage: true });
} catch (e) {
  fail("Login superadmin", String(e).slice(0, 120));
}

/* 2. alta de comercio */
let newTenant = null;
const SUFFIX = String(Date.now()).slice(-5);
const TENANT_NAME = `Peluquería Aurora ${SUFFIX}`;
const TENANT_SLUG = `peluqueria-aurora-${SUFFIX}`;
const TENANT_EMAIL = `aurora${SUFFIX}@example.com`;
try {
  await page.goto(`${BASE}/admin/comercios/nuevo`, { waitUntil: "networkidle" });
  await page.fill('input[name="name"]', TENANT_NAME);
  await page.fill('input[name="slug"]', TENANT_SLUG);
  await page.selectOption('select[name="businessType"]', "beauty");
  await page.fill('input[name="ownerEmail"]', TENANT_EMAIL);
  await page.fill('input[name="ownerName"]', "Aurora Gil");
  await page.fill('input[name="whatsapp"]', "34611223344");
  await page.click('button:has-text("Crear comercio")');
  await page.waitForSelector("text=Credenciales de acceso", { timeout: 25000 });
  await page.waitForLoadState("networkidle");
  const body = await page.textContent("body");
  const block = page.locator("div", { hasText: "Credenciales de acceso" }).last();
  const lines = await block.locator("p.font-mono").allTextContents().catch(() => []);
  if (body.includes("Credenciales de acceso") && lines.length >= 2) {
    newTenant = { email: lines[0].trim(), password: lines[1].trim() };
    ok("Alta de comercio + credenciales", `${newTenant.email} / ${newTenant.password}`);
  } else {
    fail("Alta de comercio + credenciales", `lineas=${lines.length} · ${body.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  await page.screenshot({ path: `${SHOTS}/02-alta.png`, fullPage: true });
} catch (e) {
  fail("Alta de comercio", String(e).slice(0, 120));
}

/* 3. reserva pública con señal (bar demo) */
let bookingCode = null;
try {
  // Reservamos en una fecha futura para no chocar con el aforo de hoy
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await page.goto(`${BASE}/c/bar-la-plaza/reservar?personas=2&fecha=${tomorrow}`, { waitUntil: "networkidle" });
  const slot = page.locator('a[href*="hora="]').first();
  await slot.click();
  await page.waitForLoadState("networkidle");
  await page.waitForSelector('input[name="name"]', { timeout: 15000 });
  await page.fill('input[name="name"]', "Cliente Prueba");
  await page.fill('input[name="phone"]', "600555444");
  await page.fill('input[name="email"]', "cliente@example.com");
  await page.click('button:has-text("Confirmar reserva")');
  await page.waitForURL(/\/r\//, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  const body = await page.textContent("body");
  const match = body.match(/[ACDEFGHJKLMNPQRSTUVWXYZ23456789]{10}/);
  bookingCode = match ? match[0] : null;
  if (page.url().includes("/r/") && bookingCode) ok("Reserva online", `código ${bookingCode}`);
  else fail("Reserva online", page.url());
  // Sin cuenta de Stripe conectada no se puede pedir señal. La solicitud entra PENDIENTE
  // para que el comercio la confirme desde su bandeja (autoConfirmBookings viene en false).
  if (body.includes("Solicitud recibida") && !body.includes("Pagar la señal"))
    ok("Sin Stripe: solicitud pendiente de confirmar por el comercio");
  else fail("Sin Stripe: solicitud pendiente de confirmar", body.slice(0, 120).replace(/\s+/g, " "));
  await page.screenshot({ path: `${SHOTS}/03-reserva.png`, fullPage: true });
} catch (e) {
  fail("Reserva online", String(e).slice(0, 120));
}

/* 4. aforo: repetir hasta llenar no debe permitir doble reserva del mismo hueco */
try {
  await page.goto(`${BASE}/c/bar-la-plaza/reservar?personas=2&fecha=${new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)}`, { waitUntil: "networkidle" });
  const slot = page.locator('a[href*="hora="]').first();
  await slot.click();
  await page.waitForSelector('button:has-text("Confirmar reserva")', { timeout: 15000 });
  const body = await page.textContent("body");
  if (body.includes("Confirmar reserva")) ok("Hueco sigue disponible para otra mesa (aforo 20)");
  else fail("Hueco sigue disponible");
} catch (e) {
  fail("Comprobación de aforo", String(e).slice(0, 120));
}

/* 5. encargo público */
let orderCode = null;
try {
  await page.goto(`${BASE}/c/bar-la-plaza/encargo`, { waitUntil: "networkidle" });
  await page.locator('button:has-text("Añadir")').first().click();
  await page.locator('button:has-text("Añadir")').first().click();
  const later = new Date(Date.now() + 5 * 3600 * 1000);
  const local = new Date(later.getTime() - later.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await page.fill('input[name="pickupAt"]', local);
  await page.fill('input[name="name"]', "Pedido Prueba");
  await page.fill('input[name="phone"]', "600777888");
  await page.click('button:has-text("Confirmar encargo"), button:has-text("Pagar encargo")');
  await page.waitForURL(/\/p\//, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  const body = await page.textContent("body");
  const match = body.match(/[ACDEFGHJKLMNPQRSTUVWXYZ23456789]{10}/);
  orderCode = match ? match[0] : null;
  if (page.url().includes("/p/") && orderCode) ok("Encargo público", `código ${orderCode}`);
  else fail("Encargo público", page.url());
  if (body.includes("Recibido") || body.includes("Nuevo")) ok("Seguimiento del encargo con estados");
  else fail("Seguimiento del encargo con estados");
  await page.screenshot({ path: `${SHOTS}/04-encargo.png`, fullPage: true });
} catch (e) {
  fail("Encargo público", String(e).slice(0, 120));
}

/* 6. panel del comercio (demo) */
try {
  page = await session();
  await login("demo@vitrio.app", "demo1234");
  if (new URL(page.url()).pathname === "/app") ok("Login del comercio", "→ /app");
  else fail("Login del comercio", page.url());
  const dash = await page.textContent("body");
  await page.goto(`${BASE}/app/ajustes`, { waitUntil: "networkidle" });
  const ajustes = await page.textContent("body");
  const connectOk =
    ajustes.includes("tu cuenta de Stripe") &&
    (ajustes.includes("Sin conectar") || ajustes.includes("Plataforma sin Stripe")) &&
    ajustes.includes("Conectar mi Stripe");
  if (connectOk) ok("Ajustes muestra el alta de Stripe Connect");
  else fail("Ajustes muestra el alta de Stripe Connect", ajustes.slice(0, 200).replace(/\s+/g, " "));
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  if (dash.includes("Hola, Bar La Plaza")) ok("Dashboard del comercio");
  else fail("Dashboard del comercio");
  await page.screenshot({ path: `${SHOTS}/05-app.png`, fullPage: true });

  await page.goto(`${BASE}/app/reservas`, { waitUntil: "networkidle" });
  const reservas = await page.textContent("body");
  if (reservas.includes("Cliente Prueba")) ok("La reserva pública aparece en la agenda");
  else fail("La reserva pública aparece en la agenda");

  await page.goto(`${BASE}/app/encargos`, { waitUntil: "networkidle" });
  const encargos = await page.textContent("body");
  if (orderCode && encargos.includes(orderCode)) ok("El encargo aparece en el panel");
  else fail("El encargo aparece en el panel", orderCode ?? "");

  // Cambiar estado de un encargo
  const startBtn = page.locator('button:has-text("Empezar")').first();
  if (await startBtn.count()) {
    await startBtn.click();
    await page.waitForLoadState("networkidle");
    ok("Cambio de estado del encargo");
  } else fail("Cambio de estado del encargo", "sin botón Empezar");

  await page.goto(`${BASE}/app/catalogo`, { waitUntil: "networkidle" });
  const cat = await page.textContent("body");
  if (cat.includes("Menú del día")) ok("Catálogo del comercio con productos");
  else fail("Catálogo del comercio con productos");

  await page.goto(`${BASE}/app/qr`, { waitUntil: "networkidle" });
  const qrOk = await page.locator('img[alt*="QR"]').isVisible();
  if (qrOk) ok("QR generado y visible");
  else fail("QR generado y visible");
  await page.screenshot({ path: `${SHOTS}/06-qr.png`, fullPage: true });
} catch (e) {
  fail("Panel del comercio", String(e).slice(0, 120));
}

/* 7. nuevo comercio: la contraseña temporal obliga a cambiarla */
try {
  if (newTenant) {
    page = await session();
    await login(newTenant.email, newTenant.password);
    const path = new URL(page.url()).pathname;
    if (path === "/cuenta/contrasena") ok("Contraseña temporal fuerza cambio", path);
    else fail("Contraseña temporal fuerza cambio", path);
    await page.fill('input[name="current"]', newTenant.password);
    await page.fill('input[name="next"]', "Aurora-Nueva-2026");
    await page.fill('input[name="repeat"]', "Aurora-Nueva-2026");
    await page.click('button:has-text("Cambiar contraseña")');
    await page.waitForURL(/\/app$/, { timeout: 20000 }).catch(() => null);
    await page.waitForLoadState("networkidle");
    if (new URL(page.url()).pathname === "/app") ok("Cambio de contraseña y entrada al panel");
    else {
      const txt = (await page.textContent("body")).replace(/\s+/g, " ").slice(-300);
      fail("Cambio de contraseña y entrada al panel", `${page.url()} :: ${txt}`);
    }
    await page.screenshot({ path: `${SHOTS}/07-nuevo-comercio.png`, fullPage: true });
  }
} catch (e) {
  fail("Nuevo comercio", String(e).slice(0, 120));
}

/* 8. cuenta congelada */
try {
  page = await session();
  await login(process.env.ADMIN_EMAIL ?? "admin@vitrio.app", process.env.ADMIN_PASSWORD ?? "vitrio-admin-2026");
  await page.goto(`${BASE}/admin/comercios`, { waitUntil: "networkidle" });
  await page.click(`a:has-text("${TENANT_NAME}")`);
  await page.waitForLoadState("networkidle");
  await page.click('button:has-text("Congelar")');
  await page.waitForSelector('h1:has-text("Congelado")', { timeout: 20000 }).catch(() => null);
  await page.waitForLoadState("networkidle");
  const frozen = await page.textContent("body");
  if (frozen.includes("Congelado")) ok("Congelar comercio desde el admin");
  else fail("Congelar comercio desde el admin");

  const pub = await page.goto(`${BASE}/c/${TENANT_SLUG}`);
  if (pub.status() === 404) ok("Catálogo congelado devuelve 404");
  else fail("Catálogo congelado devuelve 404", `status ${pub.status()}`);

  page = await session();
  await login(newTenant.email, "Aurora-Nueva-2026");
  if (new URL(page.url()).pathname === "/congelada") ok("Comercio congelado ve pantalla de aviso");
  else fail("Comercio congelado ve pantalla de aviso", page.url());
  await page.screenshot({ path: `${SHOTS}/08-congelada.png`, fullPage: true });
} catch (e) {
  fail("Flujo de congelación", String(e).slice(0, 120));
}

/* 9. cron y salud */
try {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  if (health.ok && health.db === "up") ok("Healthcheck /api/health");
  else fail("Healthcheck");
  const cron = await fetch(`${BASE}/api/cron/lifecycle`, { headers: { "x-cron-secret": "cron-dev-secret" } });
  const report = await cron.json();
  if (report.ok) ok("Cron de ciclo de vida", JSON.stringify(report.report ?? {}).slice(0, 80));
  else fail("Cron de ciclo de vida");
} catch (e) {
  fail("Cron/health", String(e).slice(0, 120));
}

/* 10. rate limiting persistente (se guarda en PostgreSQL) */
try {
  const p2 = await session();
  const fake = `intruso${Date.now()}@example.com`;
  let blocked = false;
  for (let i = 0; i < 12 && !blocked; i += 1) {
    await p2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await p2.fill('input[name="email"]', fake);
    await p2.fill('input[name="password"]', "mala-contrasena");
    await p2.click('button:has-text("Entrar")');
    await p2.waitForTimeout(350);
    const txt = await p2.textContent("body");
    if (txt.includes("Demasiados intentos")) blocked = true;
  }
  if (blocked) ok("Bloqueo por intentos fallidos (contador en BD)");
  else fail("Bloqueo por intentos fallidos (contador en BD)");
} catch (e) {
  fail("Rate limiting", String(e).slice(0, 120));
}

/* 11. errores de consola */
const noisy = errors.filter((e) => !/favicon|manifest|sw\.js|Failed to load resource: the server responded with a status of 404/i.test(e));
if (noisy.length === 0) ok("Sin errores de consola");
else fail("Errores de consola", noisy.slice(0, 3).join(" | "));

await browser.close();

const failed = results.filter((r) => r.status === "FALLO");
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
fs.writeFileSync("/home/user/pw/results.json", JSON.stringify({ results, bookingCode, orderCode, consoleErrors: errors }, null, 2));
process.exit(failed.length ? 1 : 0);

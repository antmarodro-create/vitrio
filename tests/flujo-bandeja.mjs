/**
 * Circuito completo: el cliente reserva en el showroom, el comercio lo ve en su bandeja,
 * confirma, y el cliente ve el cambio en su página de seguimiento.
 *
 *   BASE_URL=http://localhost:3000 node tests/flujo-bandeja.mjs
 *
 * Necesita el showroom cargado (npm run demo:showroom) y playwright instalado.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 940 } });

// 1) El cliente entra en la reserva del comercio
await page.goto(`${BASE}/c/bodega-lumiere/reservar?personas=3`, { waitUntil: "load" });
await page.waitForTimeout(600);

// elige el primer hueco libre
const slot = page.locator('a[aria-disabled="false"]').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
const hora = (await slot.textContent())?.trim();
await slot.click();
await page.waitForTimeout(800);

// 2) rellena y envía
await page.fill('input[name="name"]', "Prueba Cliente");
await page.fill('input[name="phone"]', "600 123 456");
await page.fill('textarea[name="notes"]', "Mesa junto a la ventana si es posible");
await page.screenshot({ path: `${process.env.SHOTS_DIR ?? "/tmp"}/09-formulario.png`, fullPage: false });
await page.click('button:has-text("Confirmar reserva")');
await page.waitForURL(/\/r\//, { timeout: 15000 });
const code = page.url().split("/r/")[1];
await page.waitForTimeout(700);
await page.screenshot({ path: `${process.env.SHOTS_DIR ?? "/tmp"}/10-recibida.png`, fullPage: false });
console.log(`reserva creada ${code} a las ${hora}`);

// 3) el comercio la ve en su bandeja y la confirma
const owner = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await owner.goto(`${BASE}/login`, { waitUntil: "load" });
await owner.fill('input[name="email"]', "lumiere@vitrio.app");
await owner.fill('input[name="password"]', "demo1234");
await owner.click('button:has-text("Entrar")');
await owner.waitForTimeout(1800);
await owner.goto(`${BASE}/app/bandeja`, { waitUntil: "load" });
await owner.waitForTimeout(500);

const row = owner.locator("li").filter({ hasText: "Prueba Cliente" }).first();
const found = (await row.count()) > 0;
console.log("¿aparece en la bandeja del comercio?", found ? "SÍ" : "NO");
await owner.screenshot({ path: `${process.env.SHOTS_DIR ?? "/tmp"}/11-bandeja-nueva.png` });

await row.locator('button:has-text("Confirmar")').click();
await owner.waitForTimeout(1800);

// 4) el cliente ve el cambio en su seguimiento
await page.goto(`${BASE}/r/${code}`, { waitUntil: "load" });
await page.waitForTimeout(700);
const heading = (await page.locator("h1").first().textContent())?.trim();
const trazas = await page.locator("ol li").allTextContents();
await page.screenshot({ path: `${process.env.SHOTS_DIR ?? "/tmp"}/12-confirmada.png`, fullPage: true });
console.log("estado que ve el cliente:", heading);
console.log("trazas:", trazas.map((t) => t.replace(/\s+/g, " ").trim()).join(" | "));

// 5) comprobación final
const ok = heading?.includes("confirmada") && trazas.length >= 2;
console.log(ok ? "\n✅ CIRCUITO COMPLETO: reserva → bandeja → confirmación → seguimiento" : "\n❌ algo falló");
await browser.close();
process.exit(ok ? 0 : 1);

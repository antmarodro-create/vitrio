import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { hashPassword } from "@/lib/password";
import { DEFAULT_PLANS } from "@/lib/plans";
import { defaultHours } from "@/lib/time";
import { pgConnection } from "@/lib/pgconfig";

const pool = new Pool({ ...pgConnection(process.env.DATABASE_URL), max: 1 });
const db = drizzle(pool, { schema });

async function seedPlans() {
  for (const plan of DEFAULT_PLANS) {
    const existing = await db.select().from(schema.plans).where(eq(schema.plans.slug, plan.slug)).limit(1);
    if (existing[0]) {
      await db
        .update(schema.plans)
        .set({
          name: plan.name,
          priceMonthlyCents: plan.priceMonthlyCents,
          priceYearlyCents: plan.priceYearlyCents,
          features: plan.features,
          maxProducts: plan.maxProducts,
          maxBookingsMonth: plan.maxBookingsMonth,
          sortOrder: plan.sortOrder,
        })
        .where(eq(schema.plans.id, existing[0].id));
      continue;
    }
    await db.insert(schema.plans).values(plan);
  }
  console.log(`✓ ${DEFAULT_PLANS.length} planes`);
}

async function seedAdmin() {
  // SEED_ADMIN=false permite sembrar solo planes y demo (util despues de crear el
  // superadmin en /setup, porque /setup deja de estar disponible en cuanto hay usuarios).
  if ((process.env.SEED_ADMIN ?? "true") !== "true") {
    console.log("· SEED_ADMIN=false: no se crea superadmin");
    return;
  }
  const email = (process.env.ADMIN_EMAIL ?? "admin@vitrio.app").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.log("· ADMIN_PASSWORD no definida: no se crea superadmin");
    return;
  }
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing[0]) {
    console.log(`· superadmin ya existe (${email})`);
    return;
  }
  await db.insert(schema.users).values({
    email,
    passwordHash: hashPassword(password),
    role: "superadmin",
  });
  console.log(`✓ superadmin ${email}`);
}

async function seedDemo() {
  if ((process.env.SEED_DEMO ?? "true") !== "true") return;

  const slug = "bar-la-plaza";
  const existing = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, slug)).limit(1);
  if (existing[0]) {
    console.log("· comercio demo ya existe");
    return;
  }

  const proPlan = (await db.select().from(schema.plans).where(eq(schema.plans.slug, "pro")).limit(1))[0] ?? null;
  const now = new Date();

  const created = await db
    .insert(schema.tenants)
    .values({
      slug,
      name: "Bar La Plaza",
      businessType: "bar",
      status: "active",
      planId: proPlan?.id ?? null,
      ownerEmail: "demo@vitrio.app",
      ownerName: "Equipo Vitrio",
      phone: "600 123 456",
      whatsapp: "34600123456",
      address: "Plaza del Ayuntamiento 3",
      city: "Alicante",
      primaryColor: "#0f766e",
      trialEndsAt: null,
      bookingsEnabled: true,
      ordersEnabled: true,
      hours: defaultHours(),
      slotMinutes: 30,
      durationMinutes: 90,
      capacity: 20,
      maxParty: 8,
      noticeMinutes: 60,
      prepay: "deposit",
      depositCents: 500,
      orderNoticeHours: 1,
      paymentCardEnabled: true,
      paymentBizumEnabled: true,
      policyText:
        "La mesa se guarda 15 minutos. Si no puedes venir, avísanos por WhatsApp y te devolvemos la señal.",
    })
    .returning();

  const tenant = created[0];

  await db.insert(schema.products).values([
    {
      tenantId: tenant.id,
      kind: "product",
      name: "Menú del día",
      description: "Primero, segundo, bebida y postre. De lunes a viernes.",
      priceCents: 1350,
      category: "Menús",
      visible: true,
      sortOrder: 1,
    },
    {
      tenantId: tenant.id,
      kind: "product",
      name: "Croquetas caseras (6)",
      description: "De jamón ibérico, hechas cada mañana.",
      priceCents: 780,
      category: "Para compartir",
      visible: true,
      sortOrder: 2,
    },
    {
      tenantId: tenant.id,
      kind: "product",
      name: "Tarta de queso",
      description: "Con mermelada de frutos rojos.",
      priceCents: 550,
      category: "Postres",
      visible: true,
      sortOrder: 3,
    },
    {
      tenantId: tenant.id,
      kind: "product",
      name: "Caña",
      priceCents: 200,
      category: "Bebidas",
      visible: true,
      sortOrder: 4,
    },
    {
      tenantId: tenant.id,
      kind: "product",
      name: "Vino de la casa (copa)",
      priceCents: 250,
      category: "Bebidas",
      visible: true,
      sortOrder: 5,
    },
    {
      tenantId: tenant.id,
      kind: "service",
      name: "Comida para grupos",
      description: "Mesa reservada con menú cerrado para grupos de 6 a 20.",
      priceCents: 2200,
      durationMinutes: 120,
      capacity: 3,
      depositCents: 3000,
      visible: true,
      sortOrder: 6,
    },
  ]);

  const demoUser = await db.select().from(schema.users).where(eq(schema.users.email, "demo@vitrio.app")).limit(1);
  if (!demoUser[0]) {
    await db.insert(schema.users).values({
      tenantId: tenant.id,
      email: "demo@vitrio.app",
      passwordHash: hashPassword("demo1234"),
      role: "owner",
      mustChangePassword: false,
    });
  }

  // Una reserva de ejemplo para hoy a las 21:00 (hora del negocio)
  const startsAt = now;
  startsAt.setHours(21, 0, 0, 0);
  await db.insert(schema.appointments).values({
    tenantId: tenant.id,
    customerName: "Lucía Ferrer",
    customerPhone: "699 111 222",
    customerEmail: "lucia@example.com",
    partySize: 4,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 90 * 60_000),
    status: "confirmed",
    source: "online",
    code: "DEMO21X4AB",
    depositCents: 2000,
    paymentStatus: "paid",
    paymentMethod: "card",
  });

  console.log(`✓ comercio demo /c/${slug} (demo@vitrio.app / demo1234)`);
}

async function main() {
  if ((process.env.SEED_PLANS ?? "true") !== "false") await seedPlans();
  await seedAdmin();
  await seedDemo();
  await pool.end();
  console.log("Seed completado");
}

main().catch(async (err) => {
  console.error("Error en el seed:", err);
  await pool.end();
  process.exit(1);
});

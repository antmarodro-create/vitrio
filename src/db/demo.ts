/**
 * Comercios de demostración, uno por plan, para enseñar el producto con datos
 * creíbles: carta real, fotos, horarios, reservas y encargos ya en marcha.
 *
 *   npm run db:demo-full        (o: npm run demo:showroom)
 *
 * Idempotente: borra y recrea solo los comercios con estos slugs.
 *   bodega-lumiere  → plan Pro      (reservas de mesa + encargos + cobros)
 *   lumen-panaderia → plan Básico   (catálogo + QR, sin reservas: se ve el límite)
 *   salon-ebano     → plan Premium  (citas con señal, encargos, todo)
 *
 * Contraseña de los tres paneles: demo1234
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureDefaultPlans } from "@/lib/bootstrap";
import { hashPassword } from "@/lib/password";
import { zonedToUtc } from "@/lib/time";
import { appointments, events, orderItems, orders, plans, products, tenants, users } from "@/db/schema";
import { loadEnv } from "@/lib/load-env";

const TZ = "Europe/Madrid";
const DEMO_PASSWORD = "demo1234";

async function image(file: string): Promise<string | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "demo", file));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function at(offsetDays: number, hh: number, mm: number): Date {
  const base = new Date();
  const d = new Date(base.getTime() + offsetDays * 86_400_000);
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, day] = iso.split("-").map(Number);
  return zonedToUtc(y, m, day, hh, mm, TZ);
}

/** Fecha en el pasado, para que las trazas del showroom tengan sentido temporal. */
function createdHoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

function code(prefix: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = prefix;
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const WEEKDAYS_OPEN = (from: string, to: string, extra?: [string, string][]) => [from, to, ...(extra ?? [])] as unknown;

type Demo = {
  slug: string;
  name: string;
  planSlug: "basico" | "pro" | "premium";
  businessType: string;
  tagline: string;
  ownerEmail: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  primaryColor: string;
  policyText: string;
  hours: Record<string, string[][]>;
  settings: {
    bookingsEnabled: boolean;
    ordersEnabled: boolean;
    capacity: number;
    maxParty: number;
    slotMinutes: number;
    durationMinutes: number;
    noticeMinutes: number;
    prepay: string;
    depositCents: number;
    orderNoticeHours: number;
    paymentCardEnabled: boolean;
    paymentBizumEnabled: boolean;
  };
  products: Array<{
    name: string;
    description: string;
    priceCents: number;
    category: string;
    kind?: "product" | "service";
    durationMinutes?: number;
    depositCents?: number;
    image?: string;
  }>;
  bookings?: Array<{
    name: string;
    phone: string;
    party: number;
    offsetDays: number;
    hh: number;
    mm: number;
    status: "pending" | "confirmed";
    service?: string;
  }>;
  orders?: Array<{ name: string; phone: string; items: Array<[string, number]>; offsetHours: number; status: string }>;
};

const DEMOS: Demo[] = [
  {
    slug: "bodega-lumiere",
    name: "Bodega Lumière",
    planSlug: "pro",
    businessType: "bar",
    tagline: "Cocina de mercado y vinos de pequeños productores",
    ownerEmail: "lumiere@vitrio.app",
    ownerName: "Ana Ferrer",
    phone: "965 12 34 56",
    whatsapp: "34655123456",
    address: "Calle Castaños 14",
    city: "Alicante",
    primaryColor: "#2b2118",
    policyText:
      "La señal de 15 € se descuenta de la cuenta. Cancelación gratuita hasta 4 horas antes; después no se devuelve.",
    hours: {
      "0": [],
      "1": [],
      "2": [["13:00", "16:00"], ["20:00", "23:30"]],
      "3": [["13:00", "16:00"], ["20:00", "23:30"]],
      "4": [["13:00", "16:00"], ["20:00", "23:30"]],
      "5": [["13:00", "16:00"], ["20:00", "23:30"]],
      "6": [["13:00", "16:00"], ["20:00", "23:30"]],
    },
    settings: {
      bookingsEnabled: true,
      ordersEnabled: true,
      capacity: 24,
      maxParty: 8,
      slotMinutes: 30,
      durationMinutes: 90,
      noticeMinutes: 90,
      prepay: "deposit",
      depositCents: 1500,
      orderNoticeHours: 3,
      paymentCardEnabled: true,
      paymentBizumEnabled: true,
    },
    products: [
      {
        name: "Vieira sellada, puré de guisantes y microgreens",
        description: "Vieira de Huelva sellada al momento, crema de guisante lágrima y aceite de cebollino.",
        priceCents: 2400,
        category: "Para empezar",
        image: "bodega-lumiere-1.jpg",
      },
      {
        name: "Steak tartar de vaca madurada",
        description: "Cortado a cuchillo, mostaza antigua, yema curada y pan de masa madre tostado.",
        priceCents: 2100,
        category: "Para empezar",
        image: "bodega-lumiere-2.jpg",
      },
      {
        name: "Arroz meloso de carabineros",
        description: "Arroz bomba, carabineros de Santa Pola y alioli de azafrán. Mínimo dos personas.",
        priceCents: 2900,
        category: "Principales",
        image: "bodega-lumiere-3.jpg",
      },
      {
        name: "Wagyu a la brasa, jugo de tuétano",
        description: "Wagyu nacional madurado 30 días, brasa de encina y verduras de temporada.",
        priceCents: 3800,
        category: "Principales",
        image: "bodega-lumiere-4.jpg",
      },
      {
        name: "Tarta de queso al horno",
        description: "Cremosa por dentro, con mermelada de frambuesa de la sierra.",
        priceCents: 900,
        category: "Postres",
        image: "bodega-lumiere-5.jpg",
      },
    ],
    bookings: [
      { name: "Marta Ruiz", phone: "600 112 233", party: 2, offsetDays: 0, hh: 21, mm: 0, status: "pending" },
      { name: "Javier Prats", phone: "655 998 100", party: 4, offsetDays: 1, hh: 13, mm: 30, status: "confirmed" },
      { name: "Lucía Marín", phone: "611 554 300", party: 6, offsetDays: 1, hh: 21, mm: 0, status: "pending" },
      { name: "Pablo Sanz", phone: "699 221 010", party: 2, offsetDays: 2, hh: 20, mm: 30, status: "confirmed" },
    ],
    orders: [
      { name: "Carla Ortín", phone: "622 445 900", items: [["Tarta de queso al horno", 2]], offsetHours: 20, status: "new" },
    ],
  },
  {
    slug: "lumen-panaderia",
    name: "Lumen Panadería",
    planSlug: "basico",
    businessType: "shop",
    tagline: "Masa madre, mantequilla francesa y horno de piedra desde 1998",
    ownerEmail: "lumen@vitrio.app",
    ownerName: "Tomás Lledó",
    phone: "965 44 22 10",
    whatsapp: "34655442210",
    address: "Plaza de la Viña 3",
    city: "Alicante",
    primaryColor: "#8b6b3a",
    policyText: "Elaboración diaria. Reserva de hogazas por teléfono a partir de las 8:00.",
    hours: {
      "0": [],
      "1": [],
      "2": [["08:00", "15:00"]],
      "3": [["08:00", "15:00"]],
      "4": [["08:00", "15:00"]],
      "5": [["08:00", "15:00"]],
      "6": [["08:00", "15:00"]],
    },
    settings: {
      bookingsEnabled: false,
      ordersEnabled: false,
      capacity: 1,
      maxParty: 1,
      slotMinutes: 30,
      durationMinutes: 30,
      noticeMinutes: 0,
      prepay: "none",
      depositCents: 0,
      orderNoticeHours: 2,
      paymentCardEnabled: true,
      paymentBizumEnabled: false,
    },
    products: [
      {
        name: "Croissant de mantequilla",
        description: "Laminado a mano con mantequilla francesa AOP, 27 capas.",
        priceCents: 280,
        category: "Bollería",
        image: "lumen-panaderia-1.jpg",
      },
      {
        name: "Croissant de almendra",
        description: "Relleno de crema de almendra tostada y azúcar glas.",
        priceCents: 340,
        category: "Bollería",
        image: "lumen-panaderia-2.jpg",
      },
      {
        name: "Hogaza de masa madre",
        description: "Fermentación de 24 horas, harina ecológica y corteza gruesa. 1 kg.",
        priceCents: 560,
        category: "Panes",
        image: "lumen-panaderia-3.jpg",
      },
      {
        name: "Pan de centeno y semillas",
        description: "Centeno integral, girasol y lino. Ideal para tostas. 800 g.",
        priceCents: 480,
        category: "Panes",
        image: "lumen-panaderia-4.jpg",
      },
      {
        name: "Tarta de queso del obrador",
        description: "Porción generosa, horneada cada mañana.",
        priceCents: 390,
        category: "Dulces",
        image: "lumen-panaderia-5.jpg",
      },
    ],
  },
  {
    slug: "salon-ebano",
    name: "Salón Ébano",
    planSlug: "premium",
    businessType: "beauty",
    tagline: "Color, corte y rituales de cuidado en un espacio tranquilo",
    ownerEmail: "ebano@vitrio.app",
    ownerName: "Nuria Blasco",
    phone: "965 78 90 12",
    whatsapp: "34665789012",
    address: "Avenida Maisonnave 21",
    city: "Alicante",
    primaryColor: "#4a2b3a",
    policyText:
      "La señal se descuenta del servicio. Cambios y cancelaciones con 24 horas de antelación.",
    hours: {
      "0": [],
      "1": [],
      "2": [["10:00", "20:00"]],
      "3": [["10:00", "20:00"]],
      "4": [["10:00", "20:00"]],
      "5": [["10:00", "20:00"]],
      "6": [["09:00", "14:00"]],
    },
    settings: {
      bookingsEnabled: true,
      ordersEnabled: true,
      capacity: 2,
      maxParty: 1,
      slotMinutes: 30,
      durationMinutes: 60,
      noticeMinutes: 240,
      prepay: "deposit",
      depositCents: 1500,
      orderNoticeHours: 24,
      paymentCardEnabled: true,
      paymentBizumEnabled: true,
    },
    products: [
      {
        name: "Corte y peinado",
        description: "Diagnóstico, corte personalizado, lavado con masaje y acabado.",
        priceCents: 4500,
        category: "Peluquería",
        kind: "service",
        durationMinutes: 60,
        depositCents: 0,
        image: "salon-ebano-1.jpg",
      },
      {
        name: "Color y mechas balayage",
        description: "Coloración sin amoniaco, matización y tratamiento de sellado.",
        priceCents: 12000,
        category: "Color",
        kind: "service",
        durationMinutes: 150,
        depositCents: 2000,
        image: "salon-ebano-4.jpg",
      },
      {
        name: "Ritual facial de luminoterapia",
        description: "Limpieza profunda, ácidos suaves y mascarilla de vitamina C.",
        priceCents: 6500,
        category: "Cabina",
        kind: "service",
        durationMinutes: 60,
        depositCents: 1500,
        image: "salon-ebano-2.jpg",
      },
      {
        name: "Peinado de evento",
        description: "Recogidos y ondas para invitada, con fijación de larga duración.",
        priceCents: 4000,
        category: "Peluquería",
        kind: "service",
        durationMinutes: 45,
        image: "salon-ebano-3.jpg",
      },
      {
        name: "Champú de cacao y keratina",
        description: "Limpieza suave para cabello teñido. 250 ml.",
        priceCents: 2800,
        category: "Tienda",
        kind: "product",
      },
      {
        name: "Aceite capilar de argán",
        description: "Acabado brillante sin peso. 50 ml.",
        priceCents: 3400,
        category: "Tienda",
        kind: "product",
      },
    ],
    bookings: [
      {
        name: "Elena Vidal",
        phone: "610 445 221",
        party: 1,
        offsetDays: 1,
        hh: 10,
        mm: 0,
        status: "confirmed",
        service: "Color y mechas balayage",
      },
      {
        name: "Rocío Peña",
        phone: "677 001 448",
        party: 1,
        offsetDays: 1,
        hh: 12,
        mm: 30,
        status: "pending",
        service: "Ritual facial de luminoterapia",
      },
      {
        name: "Inés Barceló",
        phone: "644 772 119",
        party: 1,
        offsetDays: 2,
        hh: 17,
        mm: 0,
        status: "pending",
        service: "Corte y peinado",
      },
    ],
    orders: [
      {
        name: "Marina Quiles",
        phone: "688 330 121",
        items: [["Champú de cacao y keratina", 1], ["Aceite capilar de argán", 1]],
        offsetHours: 30,
        status: "new",
      },
    ],
  },
];

async function resetTenant(slug: string) {
  const rows = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  const id = rows[0]?.id;
  if (!id) return;
  // Borrado explícito en orden para no depender de cascadas en todos los motores.
  const appts = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.tenantId, id));
  if (appts.length) await db.delete(appointments).where(inArray(appointments.id, appts.map((a) => a.id)));
  const ords = await db.select({ id: orders.id }).from(orders).where(eq(orders.tenantId, id));
  if (ords.length) {
    const ids = ords.map((o) => o.id);
    await db.delete(orderItems).where(inArray(orderItems.orderId, ids));
    await db.delete(orders).where(inArray(orders.id, ids));
  }
  await db.delete(products).where(eq(products.tenantId, id));
  await db.delete(events).where(eq(events.tenantId, id));
  await db.delete(users).where(eq(users.tenantId, id));
  await db.delete(tenants).where(eq(tenants.id, id));
}

async function seedDemo(demo: Demo, planId: string) {
  const [tenant] = await db
    .insert(tenants)
    .values({
      slug: demo.slug,
      name: demo.name,
      businessType: demo.businessType,
      status: "active",
      planId,
      ownerEmail: demo.ownerEmail,
      ownerName: demo.ownerName,
      phone: demo.phone,
      whatsapp: demo.whatsapp,
      address: demo.address,
      city: demo.city,
      primaryColor: demo.primaryColor,
      tagline: demo.tagline,
      coverData: await image(`${demo.slug}-hero.jpg`),
      policyText: demo.policyText,
      hours: demo.hours,
      ...demo.settings,
    })
    .returning();

  await db.insert(users).values({
    tenantId: tenant.id,
    email: demo.ownerEmail,
    passwordHash: hashPassword(DEMO_PASSWORD),
    role: "owner",
    mustChangePassword: false,
  });

  const inserted: Array<typeof products.$inferSelect> = [];
  let order = 0;
  for (const p of demo.products) {
    const [row] = await db
      .insert(products)
      .values({
        tenantId: tenant.id,
        kind: p.kind ?? "product",
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        category: p.category,
        durationMinutes: p.durationMinutes ?? null,
        depositCents: p.depositCents ?? null,
        imageData: p.image ? await image(p.image) : null,
        sortOrder: order++,
      })
      .returning();
    inserted.push(row);
  }

  // Una cita de cada diez creada hace unas horas, para que el panel tenga vida.
  for (const b of demo.bookings ?? []) {
    const service = b.service ? inserted.find((p) => p.name === b.service) : null;
    const startsAt = at(b.offsetDays, b.hh, b.mm);
    const [row] = await db
      .insert(appointments)
      .values({
        tenantId: tenant.id,
        productId: service?.id ?? null,
        customerName: b.name,
        customerPhone: b.phone,
        partySize: b.party,
        startsAt,
        endsAt: new Date(startsAt.getTime() + (service?.durationMinutes ?? tenant.durationMinutes) * 60_000),
        status: b.status,
        source: "online",
        code: code("R"),
        depositCents: service?.depositCents ?? (tenant.prepay === "deposit" ? tenant.depositCents : 0),
        paymentStatus: "unpaid",
        createdAt: createdHoursAgo(6 + Math.random() * 18),
      })
      .returning();

    await db.insert(events).values({
      tenantId: tenant.id,
      type: "booking_created",
      meta: { id: row.id, code: row.code, partySize: row.partySize, customer: b.name },
      createdAt: createdHoursAgo(7 + Math.random() * 16),
    });
    if (b.status === "confirmed") {
      await db.insert(events).values({
        tenantId: tenant.id,
        type: "booking_confirmed",
        meta: { id: row.id, code: row.code, customer: b.name },
        createdAt: createdHoursAgo(1 + Math.random() * 4),
      });
    }
  }

  for (const o of demo.orders ?? []) {
    const items = o.items
      .map(([name, qty]) => {
        const product = inserted.find((p) => p.name === name);
        if (!product) return null;
        return { product, qty };
      })
      .filter(Boolean) as Array<{ product: (typeof inserted)[number]; qty: number }>;
    if (!items.length) continue;
    const total = items.reduce((acc, i) => acc + i.product.priceCents * i.qty, 0);
    const [row] = await db
      .insert(orders)
      .values({
        tenantId: tenant.id,
        code: code("E"),
        customerName: o.name,
        customerPhone: o.phone,
        mode: "pickup",
        pickupAt: new Date(Date.now() + o.offsetHours * 3_600_000),
        status: o.status,
        totalCents: total,
        paymentStatus: "none",
      })
      .returning();
    await db.insert(orderItems).values(
      items.map((i) => ({
        orderId: row.id,
        productId: i.product.id,
        name: i.product.name,
        unitPriceCents: i.product.priceCents,
        qty: i.qty,
        subtotalCents: i.product.priceCents * i.qty,
      })),
    );
    await db.insert(events).values({
      tenantId: tenant.id,
      type: "order_created",
      meta: { id: row.id, code: row.code, customer: o.name, total },
      createdAt: createdHoursAgo(2 + Math.random() * 5),
    });
  }

  // Escaneos de QR repartidos en los últimos días (alimenta la métrica del panel)
  const scans = 40 + Math.floor(Math.random() * 40);
  await db.insert(events).values(
    Array.from({ length: scans }, () => ({
      tenantId: tenant.id,
      type: "qr_scan",
      meta: { demo: true },
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 25) * 86_400_000),
    })),
  );

  return { tenant, products: inserted.length };
}

loadEnv();
async function main() {
  await ensureDefaultPlans();
  const planRows = await db.select().from(plans);
  const byslug = new Map(planRows.map((p) => [p.slug, p.id]));

  for (const demo of DEMOS) {
    const planId = byslug.get(demo.planSlug);
    if (!planId) throw new Error(`Falta el plan ${demo.planSlug}. Ejecuta npm run seed.`);
    await resetTenant(demo.slug);
    const { products: count } = await seedDemo(demo, planId);
    console.log(`✓ ${demo.name.padEnd(18)} /c/${demo.slug.padEnd(16)} plan ${demo.planSlug.padEnd(8)} ${count} artículos · ${demo.ownerEmail} / ${DEMO_PASSWORD}`);
  }
  console.log("\nShowroom listo. Abre /c/bodega-lumiere, /c/lumen-panaderia y /c/salon-ebano.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error sembrando el showroom:", err);
  process.exit(1);
});

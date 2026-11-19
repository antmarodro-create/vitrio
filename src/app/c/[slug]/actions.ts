"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, orderItems, orders, products } from "@/db/schema";
import { getPublicTenant, getTenantById } from "@/lib/public";
import { createBooking, publicCode } from "@/lib/booking";
import { planHas } from "@/lib/plans";
import { createCheckout, tenantCanCharge } from "@/lib/stripe";
import { addMinutes } from "@/lib/time";
import { consumeLimit } from "@/lib/ratelimit";

export type PublicState = { error: string | null };

/* -------------------------------- reservas -------------------------------- */

export async function createBookingAction(_prev: PublicState, formData: FormData): Promise<PublicState> {
  const slug = String(formData.get("slug") ?? "");
  const limited = await consumeLimit(`booking:${slug}`, 20, 10 * 60_000);
  if (!limited.ok) return { error: "Demasiados intentos seguidos. Espera unos minutos." };

  const data = await getPublicTenant(slug);
  if (!data) return { error: "Este comercio no está disponible." };
  const { tenant, plan } = data;

  if (!tenant.bookingsEnabled) return { error: "Este comercio no acepta reservas online." };
  if (!planHas(plan, "bookings")) return { error: "Las reservas online no están disponibles ahora mismo." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const partySize = Math.max(1, Number(formData.get("partySize") ?? 1));
  const productId = String(formData.get("productId") ?? "") || null;

  if (name.length < 2) return { error: "Escribe tu nombre." };
  if (phone.replace(/\D/g, "").length < 6) return { error: "Escribe un teléfono válido." };
  if (email && !email.includes("@")) return { error: "El email no parece válido." };

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return { error: "Elige una hora." };

  const paymentsAvailable = planHas(plan, "payments") && tenantCanCharge(tenant);

  const result = await createBooking({
    tenant,
    productId,
    startsAt,
    partySize,
    name,
    phone,
    email: email || null,
    notes: notes || null,
    plan,
    paymentsAvailable,
  });

  if (!result.ok) return { error: result.error };

  const code = result.appointment.code;
  if (result.requiresPayment && paymentsAvailable) {
    const checkout = await createCheckout({
      tenant,
      target: {
        kind: "booking",
        id: result.appointment.id,
        amountCents: result.appointment.depositCents,
        title: `Reserva ${code} · ${tenant.name}`,
      },
      customerEmail: email || null,
      successPath: `/r/${code}`,
      cancelPath: `/r/${code}?pago=cancelado`,
    });
    if (checkout.ok) redirect(checkout.url);
  }

  redirect(`/r/${code}`);
}

/* -------------------------------- encargos -------------------------------- */

export async function createOrderAction(_prev: PublicState, formData: FormData): Promise<PublicState> {
  const slug = String(formData.get("slug") ?? "");
  const limited = await consumeLimit(`order:${slug}`, 20, 10 * 60_000);
  if (!limited.ok) return { error: "Demasiados intentos seguidos. Espera unos minutos." };

  const data = await getPublicTenant(slug);
  if (!data) return { error: "Este comercio no está disponible." };
  const { tenant, plan } = data;

  if (!tenant.ordersEnabled) return { error: "Este comercio no acepta encargos online." };
  if (!planHas(plan, "orders")) return { error: "Los encargos no están disponibles ahora mismo." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const pickupRaw = String(formData.get("pickupAt") ?? "").trim();
  const mode = String(formData.get("mode") ?? "pickup") === "delivery" ? "delivery" : "pickup";

  if (name.length < 2) return { error: "Escribe tu nombre." };
  if (phone.replace(/\D/g, "").length < 6) return { error: "Escribe un teléfono válido." };

  let cart: { id: string; qty: number }[] = [];
  try {
    cart = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "El carrito no es válido." };
  }
  cart = cart.filter((l) => l && typeof l.id === "string" && Number(l.qty) > 0);
  if (!cart.length) return { error: "Añade algún producto al encargo." };

  // Los importes SIEMPRE se recalculan desde la base de datos
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenant.id),
        eq(products.visible, true),
        inArray(
          products.id,
          cart.map((l) => l.id),
        ),
      ),
    );

  const lines = cart
    .map((line) => {
      const product = rows.find((r) => r.id === line.id);
      if (!product || product.priceCents <= 0) return null;
      const qty = Math.min(50, Math.max(1, Math.floor(Number(line.qty))));
      return {
        productId: product.id,
        name: product.name,
        unitPriceCents: product.priceCents,
        qty,
        subtotalCents: product.priceCents * qty,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (!lines.length) return { error: "Los productos del encargo ya no están disponibles." };

  const totalCents = lines.reduce((acc, l) => acc + l.subtotalCents, 0);

  let pickupAt: Date | null = null;
  if (pickupRaw) {
    const parsed = new Date(pickupRaw);
    if (Number.isNaN(parsed.getTime())) return { error: "La hora de recogida no es válida." };
    const minTime = addMinutes(new Date(), tenant.orderNoticeHours * 60);
    if (parsed < minTime) {
      return { error: `Necesitamos al menos ${tenant.orderNoticeHours} h de antelación.` };
    }
    pickupAt = parsed;
  }

  const code = publicCode();
  // Solo se pide pago si el comercio tiene su cuenta de Stripe verificada.
  const needsPayment =
    planHas(plan, "payments") &&
    tenantCanCharge(tenant) &&
    (tenant.paymentCardEnabled || tenant.paymentBizumEnabled);

  const inserted = await db.transaction(async (tx) => {
    const created = await tx
      .insert(orders)
      .values({
        tenantId: tenant.id,
        code,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || null,
        mode,
        pickupAt,
        status: needsPayment ? "pending_payment" : "new",
        totalCents,
        paymentStatus: needsPayment ? "pending" : "none",
        notes: notes || null,
      })
      .returning();

    const order = created[0];
    await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: order.id })));
    return order;
  });

  if (needsPayment) {
    const checkout = await createCheckout({
      tenant,
      target: {
        kind: "order",
        id: inserted.id,
        amountCents: totalCents,
        title: `Encargo ${code} · ${tenant.name}`,
      },
      customerEmail: email || null,
      successPath: `/p/${code}`,
      cancelPath: `/p/${code}?pago=cancelado`,
    });
    if (checkout.ok) redirect(checkout.url);
  }

  redirect(`/p/${code}`);
}

/* --------------------------------- pagos ---------------------------------- */

async function loadByCode(kind: string, code: string) {
  if (!code) return null;
  if (kind === "booking") {
    const rows = await db.select().from(appointments).where(eq(appointments.code, code)).limit(1);
    const record = rows[0];
    return record ? { tenantId: record.tenantId, record } : null;
  }
  const rows = await db.select().from(orders).where(eq(orders.code, code)).limit(1);
  const record = rows[0];
  return record ? { tenantId: record.tenantId, record } : null;
}

export async function startPaymentAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "");
  const kind = String(formData.get("kind") ?? "");

  const loaded = await loadByCode(kind, code);
  if (!loaded) redirect("/");

  const tenant = await getTenantById(loaded.tenantId);
  if (!tenant) redirect("/");

  if (kind === "booking") {
    const booking = loaded.record as typeof appointments.$inferSelect;
    if (booking.paymentStatus === "paid" || booking.depositCents <= 0) redirect(`/r/${code}`);
    const checkout = await createCheckout({
      tenant,
      target: {
        kind: "booking",
        id: booking.id,
        amountCents: booking.depositCents,
        title: `Reserva ${code} · ${tenant.name}`,
      },
      customerEmail: booking.customerEmail,
      successPath: `/r/${code}`,
      cancelPath: `/r/${code}?pago=cancelado`,
    });
    redirect(checkout.ok ? checkout.url : `/r/${code}?pago=error`);
  }

  const order = loaded.record as typeof orders.$inferSelect;
  if (order.paymentStatus === "paid" || order.totalCents <= 0) redirect(`/p/${code}`);
  const checkout = await createCheckout({
    tenant,
    target: {
      kind: "order",
      id: order.id,
      amountCents: order.totalCents,
      title: `Encargo ${code} · ${tenant.name}`,
    },
    customerEmail: order.customerEmail,
    successPath: `/p/${code}`,
    cancelPath: `/p/${code}?pago=cancelado`,
  });
  redirect(checkout.ok ? checkout.url : `/p/${code}?pago=error`);
}

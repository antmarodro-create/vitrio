import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { config, publicUrl } from "./config";
import { db } from "./db";
import { appointments, events, orders, tenants, type Tenant } from "@/db/schema";

/**
 * Cobros con Stripe Connect y CARGO DIRECTO.
 *
 * - Vitrio tiene una cuenta de plataforma (STRIPE_SECRET_KEY) cuya única función
 *   es crear sesiones de pago y recibir webhooks.
 * - Cada comercio conecta SU cuenta de Stripe (Express). El dinero de las ventas
 *   entra directamente en la cuenta del comercio: Vitrio no lo toca, no lo retiene
 *   ni aparece como intermediario. Las comisiones de Stripe las asume el comercio.
 * - La cuota de Vitrio (mensual/anual) se factura aparte, con la cuenta de la
 *   plataforma, y no tiene nada que ver con estos cobros.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!config.stripeSecret) return null;
  if (!cached) {
    cached = new Stripe(config.stripeSecret, {
      appInfo: { name: "Vitrio", version: "1.0.0" },
    });
  }
  return cached;
}

/** La plataforma puede hablar con Stripe (hay clave y secreto de webhook). */
export function stripePlatformReady(): boolean {
  return Boolean(config.stripeSecret);
}

/** El comercio tiene su cuenta conectada y habilitada para cobrar. */
export function tenantCanCharge(tenant: Tenant): boolean {
  return Boolean(tenant.stripeAccountId && tenant.stripeChargesEnabled);
}

/** Metodos de pago que se ofrecen, segun lo que el comercio active. */
export function paymentMethodsFor(tenant: Tenant): string[] {
  const methods: string[] = [];
  if (tenant.paymentCardEnabled) methods.push("card");
  if (tenant.paymentBizumEnabled) methods.push("bizum");
  return methods.length ? methods : ["card"];
}

/* ------------------------------ onboarding -------------------------------- */

/**
 * Crea (o reutiliza) la cuenta Express del comercio. Es gratis: Stripe cobra
 * solo por operación, y en cargo directo esas comisiones las paga el comercio.
 */
export async function ensureConnectAccount(
  tenant: Tenant,
): Promise<{ ok: true; accountId: string } | { ok: false; error: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe no está configurado en el servidor." };
  if (tenant.stripeAccountId) return { ok: true, accountId: tenant.stripeAccountId };

  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "ES",
      email: tenant.ownerEmail ?? undefined,
      business_type: "company",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: tenant.name,
        url: publicUrl(`/c/${tenant.slug}`),
        product_description: "Catálogo, reservas y encargos online",
      },
      metadata: { tenantId: tenant.id, tenantSlug: tenant.slug },
    });

    await db
      .update(tenants)
      .set({ stripeAccountId: account.id, stripeConnectedAt: new Date(), updatedAt: new Date() })
      .where(eq(tenants.id, tenant.id));

    await db.insert(events).values({
      tenantId: tenant.id,
      type: "stripe_account_created",
      meta: { accountId: account.id },
    });

    return { ok: true, accountId: account.id };
  } catch (err) {
    console.error("[stripe] no se pudo crear la cuenta conectada", err);
    return { ok: false, error: "Stripe no ha permitido crear la cuenta. Revisa la configuración de Connect." };
  }
}

/** Enlace de alta/actualización de datos alojado por Stripe. */
export async function createOnboardingLink(
  tenant: Tenant,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe no está configurado en el servidor." };

  const account = await ensureConnectAccount(tenant);
  if (!account.ok) return account;

  try {
    const link = await stripe.accountLinks.create({
      account: account.accountId,
      type: "account_onboarding",
      refresh_url: publicUrl("/app/ajustes?stripe=reintentar"),
      return_url: publicUrl("/app/ajustes?stripe=ok"),
      collect: "eventually_due",
    });
    return { ok: true, url: link.url };
  } catch (err) {
    console.error("[stripe] no se pudo crear el enlace de alta", err);
    return { ok: false, error: "No se ha podido abrir el alta de Stripe. Inténtalo de nuevo." };
  }
}

/** Sincroniza el estado real de la cuenta (tras volver del onboarding). */
export async function refreshAccountStatus(
  tenant: Tenant,
): Promise<{ chargesEnabled: boolean; detailsSubmitted: boolean }> {
  const stripe = getStripe();
  if (!stripe || !tenant.stripeAccountId) {
    return { chargesEnabled: false, detailsSubmitted: false };
  }
  try {
    const account = await stripe.accounts.retrieve(tenant.stripeAccountId);
    const chargesEnabled = Boolean(account.charges_enabled);
    const detailsSubmitted = Boolean(account.details_submitted);
    await db
      .update(tenants)
      .set({ stripeChargesEnabled: chargesEnabled, stripeDetailsSubmitted: detailsSubmitted, updatedAt: new Date() })
      .where(eq(tenants.id, tenant.id));
    return { chargesEnabled, detailsSubmitted };
  } catch (err) {
    console.error("[stripe] no se pudo leer la cuenta conectada", err);
    return { chargesEnabled: false, detailsSubmitted: false };
  }
}

/** Estado legible para mostrar en el panel del comercio. */
export type ConnectStatus = "sin_configurar" | "sin_cuenta" | "pendiente" | "activa";

export function connectStatus(tenant: Tenant): ConnectStatus {
  if (!stripePlatformReady()) return "sin_configurar";
  if (!tenant.stripeAccountId) return "sin_cuenta";
  if (tenant.stripeChargesEnabled) return "activa";
  return "pendiente";
}

/* --------------------------------- cobros --------------------------------- */

export type CheckoutTarget =
  | { kind: "booking"; id: string; amountCents: number; title: string }
  | { kind: "order"; id: string; amountCents: number; title: string };

/**
 * Crea una sesion de Checkout EN LA CUENTA DEL COMERCIO (cargo directo).
 * Devuelve la URL de Stripe o un error legible.
 */
export async function createCheckout(opts: {
  tenant: Tenant;
  target: CheckoutTarget;
  customerEmail?: string | null;
  successPath: string;
  cancelPath: string;
}): Promise<{ ok: true; url: string; sessionId: string } | { ok: false; error: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Los cobros online no están configurados." };

  const { tenant, target } = opts;
  if (!tenant.stripeAccountId) {
    return { ok: false, error: "Este comercio todavía no ha conectado su cuenta de Stripe." };
  }
  if (!tenant.stripeChargesEnabled) {
    return { ok: false, error: "La cuenta de Stripe del comercio aún no está verificada para cobrar." };
  }
  if (target.amountCents < 50) return { ok: false, error: "El importe mínimo para pagar online es 0,50 €." };
  if (target.amountCents > 500000) return { ok: false, error: "El importe máximo por pago online es 5.000 €." };

  const methods = paymentMethodsFor(tenant);
  const usable = target.amountCents <= 500000 ? methods : methods.filter((m) => m !== "bizum");

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        // Los metodos se calculan dinamicamente en Stripe y aqui solo se filtran.
        allowed_payment_method_types: (usable.length ? usable : [
          "card",
        ]) as Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[],
        locale: "es",
        customer_email: opts.customerEmail ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: target.amountCents,
              product_data: { name: target.title.slice(0, 200) },
            },
          },
        ],
        metadata: {
          kind: target.kind,
          recordId: target.id,
          tenantId: tenant.id,
        },
        payment_intent_data: {
          metadata: { kind: target.kind, recordId: target.id, tenantId: tenant.id },
        },
        success_url: publicUrl(
          `${opts.successPath}${opts.successPath.includes("?") ? "&" : "?"}pago=ok&session_id={CHECKOUT_SESSION_ID}`,
        ),
        cancel_url: publicUrl(`${opts.cancelPath}${opts.cancelPath.includes("?") ? "&" : "?"}pago=cancelado`),
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      },
      // Cargo directo: la sesion se crea en la cuenta del comercio.
      { stripeAccount: tenant.stripeAccountId },
    );

    if (!session.url) return { ok: false, error: "Stripe no devolvió una URL de pago." };

    if (target.kind === "booking") {
      await db
        .update(appointments)
        .set({
          stripeSessionId: session.id,
          stripeAccountId: tenant.stripeAccountId,
          paymentStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, target.id));
    } else {
      await db
        .update(orders)
        .set({
          stripeSessionId: session.id,
          stripeAccountId: tenant.stripeAccountId,
          paymentStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, target.id));
    }

    return { ok: true, url: session.url, sessionId: session.id };
  } catch (err) {
    console.error("[stripe] checkout error", err);
    return { ok: false, error: "No se ha podido iniciar el pago. Inténtalo de nuevo." };
  }
}

/**
 * Liquida un pago: idempotente. Se llama desde el webhook (con la cuenta
 * conectada del evento) y al volver a la pagina de seguimiento, verificando
 * siempre el estado real contra la API de Stripe.
 */
export async function settlePayment(
  sessionId: string,
  accountId?: string | null,
): Promise<{ ok: boolean; kind?: string; id?: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false };

  // El cargo es directo: hay que leer la sesion en la cuenta del comercio.
  let session: Stripe.Checkout.Session;
  try {
    session = accountId
      ? await stripe.checkout.sessions.retrieve(sessionId, {}, { stripeAccount: accountId })
      : await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error("[stripe] no se pudo leer la sesion", err);
    return { ok: false };
  }

  const paid = session.payment_status === "paid" || session.status === "complete";
  if (!paid) return { ok: false };

  const kind = session.metadata?.kind;
  const recordId = session.metadata?.recordId;
  if (!kind || !recordId) return { ok: false };

  const paymentMethod = (session.payment_method_types?.[0] ?? "card") as string;
  const chargedAccount = accountId ?? session.metadata?.accountId ?? null;

  if (kind === "booking") {
    const rows = await db.select().from(appointments).where(eq(appointments.id, recordId)).limit(1);
    const booking = rows[0];
    if (!booking) return { ok: false };
    if (booking.paymentStatus === "paid") return { ok: true, kind, id: recordId };
    await db
      .update(appointments)
      .set({
        paymentStatus: "paid",
        status: "confirmed",
        stripeSessionId: session.id,
        paymentMethod,
        ...(chargedAccount ? { stripeAccountId: chargedAccount } : {}),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, recordId));
    await db.insert(events).values({
      tenantId: booking.tenantId,
      type: "payment_paid",
      meta: { kind, id: recordId, amount: session.amount_total, method: paymentMethod, account: chargedAccount },
    });
    return { ok: true, kind, id: recordId };
  }

  if (kind === "order") {
    const rows = await db.select().from(orders).where(eq(orders.id, recordId)).limit(1);
    const order = rows[0];
    if (!order) return { ok: false };
    if (order.paymentStatus === "paid") return { ok: true, kind, id: recordId };
    await db
      .update(orders)
      .set({
        paymentStatus: "paid",
        status: order.status === "pending_payment" ? "new" : order.status,
        stripeSessionId: session.id,
        paymentMethod,
        ...(chargedAccount ? { stripeAccountId: chargedAccount } : {}),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, recordId));
    await db.insert(events).values({
      tenantId: order.tenantId,
      type: "payment_paid",
      meta: { kind, id: recordId, amount: session.amount_total, method: paymentMethod, account: chargedAccount },
    });
    return { ok: true, kind, id: recordId };
  }

  return { ok: false };
}

/** Marca como fallido/caducado un intento de pago. */
export async function failPayment(sessionId: string, accountId?: string | null, reason = "expired"): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  let session: Stripe.Checkout.Session | null = null;
  try {
    session = accountId
      ? await stripe.checkout.sessions.retrieve(sessionId, {}, { stripeAccount: accountId })
      : await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    session = null;
  }

  const kind = session?.metadata?.kind;
  const recordId = session?.metadata?.recordId;
  if (!kind || !recordId) return;

  if (kind === "booking") {
    await db
      .update(appointments)
      .set({ paymentStatus: "unpaid", status: "cancelled", updatedAt: new Date() })
      .where(eq(appointments.id, recordId));
  }
  if (kind === "order") {
    await db
      .update(orders)
      .set({ paymentStatus: "unpaid", status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, recordId));
  }
  await db.insert(events).values({ type: "payment_failed", meta: { kind, recordId, reason, account: accountId } });
}

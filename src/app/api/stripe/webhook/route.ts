import type Stripe from "stripe";
import { config } from "@/lib/config";
import { getStripe, failPayment, settlePayment } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Webhook firmado de Stripe. Eventos a suscribir:
 *  checkout.session.completed
 *  checkout.session.async_payment_succeeded
 *  checkout.session.async_payment_failed
 *  checkout.session.expired
 *
 * La liquidacion es idempotente: repetir el evento no duplica nada.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !config.stripeWebhookSecret) {
    return Response.json({ ok: false, error: "stripe no configurado" }, { status: 503 });
  }

  // Nota: este endpoint es el de la PLATAFORMA y debe escuchar tambien
  // "eventos de cuentas conectadas" (event.account) en el panel de Stripe.

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ ok: false, error: "sin firma" }, { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, config.stripeWebhookSecret);
  } catch (err) {
    console.error("[webhook] firma invalida", err);
    return Response.json({ ok: false, error: "firma invalida" }, { status: 400 });
  }

  try {
    // En cargo directo el evento llega con la cuenta conectada que ha cobrado.
    const account = event.account ?? null;

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          await settlePayment(session.id, account);
        }
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await failPayment(session.id, account, event.type);
        break;
      }
      case "account.updated": {
        // El comercio ha terminado (o cambiado) la verificacion en Stripe.
        const connected = event.data.object as Stripe.Account;
        const tenantId = connected.metadata?.tenantId;
        if (tenantId) {
          const { db } = await import("@/lib/db");
          const { tenants } = await import("@/db/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(tenants)
            .set({
              stripeChargesEnabled: Boolean(connected.charges_enabled),
              stripeDetailsSubmitted: Boolean(connected.details_submitted),
              updatedAt: new Date(),
            })
            .where(eq(tenants.id, tenantId));
        }
        break;
      }
      default:
        break;
    }
    return Response.json({ received: true });
  } catch (err) {
    console.error("[webhook] error procesando", event.type, err);
    // 500 hace que Stripe reintente
    return Response.json({ ok: false }, { status: 500 });
  }
}

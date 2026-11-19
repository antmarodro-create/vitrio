"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, plans, tenants } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { createOnboardingLink, refreshAccountStatus, stripePlatformReady } from "@/lib/stripe";
import { planHas } from "@/lib/plans";

/** Abre el alta de Stripe (Connect Express) para que el comercio cobre en su cuenta. */
export async function connectStripeAction(): Promise<void> {
  const { tenant } = await requireTenant();

  const plan = tenant.planId
    ? (await db.select().from(plans).where(eq(plans.id, tenant.planId)).limit(1))[0] ?? null
    : null;
  if (!planHas(plan, "payments")) redirect("/app/ajustes?stripe=plan");
  if (!stripePlatformReady()) redirect("/app/ajustes?stripe=sin-configurar");

  const link = await createOnboardingLink(tenant);
  if (!link.ok) {
    console.error("[connect] no se pudo generar el enlace", link.error);
    redirect("/app/ajustes?stripe=error");
  }
  redirect(link.url);
}

/** Sincroniza el estado de la cuenta al volver del onboarding. */
export async function refreshStripeAction(): Promise<void> {
  const { tenant } = await requireTenant();
  const status = await refreshAccountStatus(tenant);
  await db.insert(events).values({
    tenantId: tenant.id,
    type: "stripe_account_refreshed",
    meta: { ...status },
  });
  revalidatePath("/app/ajustes");
  revalidatePath("/app/plan");
}

/** Desvincula la cuenta (no la borra en Stripe: eso lo decide el comercio). */
export async function unlinkStripeAction(): Promise<void> {
  const { tenant } = await requireTenant();
  if (!tenant.stripeAccountId) return;

  await db
    .update(tenants)
    .set({
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripeDetailsSubmitted: false,
      paymentBizumEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id));

  await db.insert(events).values({ tenantId: tenant.id, type: "stripe_account_unlinked", meta: {} });
  revalidatePath("/app/ajustes");
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, plans, tenants, users } from "@/db/schema";
import { createSession, generateTempPassword, hashPassword, requireSuperadmin } from "@/lib/auth";
import { deleteTenantData, GRACE_DAYS } from "@/lib/lifecycle";
import { addDays, defaultHours } from "@/lib/time";
import { FEATURE_KEYS } from "@/lib/plans";
import { parsePriceToCents } from "@/lib/money";

export type AdminState = {
  error: string | null;
  ok?: string | null;
  credentials?: { email: string; password: string; slug: string } | null;
};

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createTenantAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireSuperadmin();

  const name = String(formData.get("name") ?? "").trim();
  const businessType = String(formData.get("businessType") ?? "bar");
  const planId = String(formData.get("planId") ?? "") || null;
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const ownerName = String(formData.get("ownerName") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const trialDays = Math.max(1, Math.min(90, Number(formData.get("trialDays") ?? 30)));
  let slug = slugify(String(formData.get("slug") ?? "") || name);

  if (name.length < 2) return { error: "Escribe el nombre del comercio." };
  if (!ownerEmail.includes("@")) return { error: "Email del titular no válido." };
  if (!slug) slug = `comercio-${Math.random().toString(36).slice(2, 7)}`;

  const dupeSlug = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (dupeSlug.length) return { error: `La dirección /c/${slug} ya está en uso. Elige otra.` };

  const dupeEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, ownerEmail)).limit(1);
  if (dupeEmail.length) return { error: "Ese email ya tiene una cuenta en Vitrio." };

  const now = new Date();
  const inserted = await db
    .insert(tenants)
    .values({
      slug,
      name,
      businessType,
      status: "trial",
      planId,
      ownerEmail,
      ownerName,
      phone,
      whatsapp,
      address,
      city,
      trialEndsAt: addDays(now, trialDays),
      hours: defaultHours(),
      prepay: "none",
      depositCents: 0,
      bookingsEnabled: businessType === "bar" || businessType === "beauty" || businessType === "services",
      ordersEnabled: false,
    })
    .returning();

  const tenant = inserted[0];
  const tempPassword = generateTempPassword();
  await db.insert(users).values({
    tenantId: tenant.id,
    email: ownerEmail,
    passwordHash: hashPassword(tempPassword),
    role: "owner",
    mustChangePassword: true,
  });
  await db.insert(events).values({ tenantId: tenant.id, type: "tenant_created", meta: { planId, trialDays } });

  revalidatePath("/admin");
  revalidatePath("/admin/comercios");
  return {
    error: null,
    ok: `Comercio creado. Catálogo público: /c/${slug}`,
    credentials: { email: ownerEmail, password: tempPassword, slug },
  };
}

export async function setTenantStatusAction(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const tenantId = String(formData.get("tenantId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!tenantId || !["trial", "active", "frozen"].includes(status)) return;

  const now = new Date();
  const patch: Record<string, unknown> = { status, updatedAt: now };
  if (status === "active") {
    patch.frozenAt = null;
    patch.deleteAt = null;
    patch.activationRequested = false;
  }
  if (status === "frozen") {
    patch.frozenAt = now;
    patch.deleteAt = addDays(now, GRACE_DAYS);
  }
  if (status === "trial") {
    patch.trialEndsAt = addDays(now, 30);
    patch.frozenAt = null;
    patch.deleteAt = null;
  }

  await db.update(tenants).set(patch).where(eq(tenants.id, tenantId));
  await db.insert(events).values({ tenantId, type: `tenant_status_${status}`, meta: {} });
  revalidatePath(`/admin/comercios/${tenantId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/comercios");
}

export async function updateTenantAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireSuperadmin();
  const tenantId = String(formData.get("tenantId") ?? "");
  if (!tenantId) return { error: "Comercio no válido." };

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  patch.name = String(formData.get("name") ?? "").trim();
  patch.planId = String(formData.get("planId") ?? "") || null;
  patch.ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase() || null;
  patch.ownerName = String(formData.get("ownerName") ?? "").trim() || null;
  patch.phone = String(formData.get("phone") ?? "").trim() || null;
  patch.whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  patch.address = String(formData.get("address") ?? "").trim() || null;
  patch.city = String(formData.get("city") ?? "").trim() || null;
  patch.businessType = String(formData.get("businessType") ?? "bar");

  await db.update(tenants).set(patch).where(eq(tenants.id, tenantId));
  revalidatePath(`/admin/comercios/${tenantId}`);
  return { error: null, ok: "Ficha actualizada." };
}

/** Soporte: abre una sesion como el titular del comercio (queda registrado). */
export async function impersonateTenantAction(formData: FormData): Promise<void> {
  const { user } = await requireSuperadmin();
  const tenantId = String(formData.get("tenantId") ?? "");
  const owner = await db.select().from(users).where(eq(users.tenantId, tenantId)).limit(1);
  if (!owner[0]) return;

  await db.insert(events).values({
    tenantId,
    type: "impersonation",
    meta: { by: user.email, userId: owner[0].id },
  });
  await createSession(owner[0].id, owner[0].tenantId ?? null);
  redirect("/app");
}

export async function extendTrialAction(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const tenantId = String(formData.get("tenantId") ?? "");
  const days = Math.max(1, Math.min(90, Number(formData.get("days") ?? 15)));
  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const tenant = rows[0];
  if (!tenant) return;
  const base = tenant.trialEndsAt && tenant.trialEndsAt > new Date() ? tenant.trialEndsAt : new Date();
  await db
    .update(tenants)
    .set({ trialEndsAt: addDays(base, days), updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
  revalidatePath(`/admin/comercios/${tenantId}`);
}

export async function resetOwnerPasswordAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireSuperadmin();
  const tenantId = String(formData.get("tenantId") ?? "");
  const password = generateTempPassword();
  const owner = await db.select().from(users).where(eq(users.tenantId, tenantId)).limit(1);
  if (!owner[0]) return { error: "Ese comercio no tiene usuario titular." };

  await db
    .update(users)
    .set({ passwordHash: hashPassword(password), mustChangePassword: true })
    .where(eq(users.id, owner[0].id));

  return { error: null, credentials: { email: owner[0].email, password, slug: "" } };
}

export async function deleteTenantAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireSuperadmin();
  const tenantId = String(formData.get("tenantId") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (confirm !== "BORRAR") return { error: "Escribe BORRAR para confirmar." };

  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const tenant = rows[0];
  if (!tenant) return { error: "Comercio no encontrado." };

  await deleteTenantData(tenantId);
  const now = new Date();
  await db
    .update(tenants)
    .set({
      status: "deleted",
      deletedAt: now,
      anonymizedAt: now,
      name: "Comercio eliminado",
      slug: `borrado-${tenantId.slice(0, 8)}`,
      ownerEmail: null,
      ownerName: null,
      phone: null,
      whatsapp: null,
      address: null,
      city: null,
      logoData: null,
      bookingsEnabled: false,
      ordersEnabled: false,
      updatedAt: now,
    })
    .where(eq(tenants.id, tenantId));
  await db.delete(users).where(eq(users.tenantId, tenantId));
  await db.insert(events).values({ type: "tenant_deleted_manual", meta: { id: tenantId } });

  revalidatePath("/admin/comercios");
  revalidatePath("/admin");
  return { error: null, ok: "Comercio borrado y datos anonimizados." };
}

export async function savePlanAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireSuperadmin();
  const planId = String(formData.get("planId") ?? "");
  if (!planId) return { error: "Plan no válido." };

  const features: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) features[key] = formData.get(`feature_${key}`) === "on";

  const maxProductsRaw = String(formData.get("maxProducts") ?? "").trim();
  const maxBookingsRaw = String(formData.get("maxBookingsMonth") ?? "").trim();

  await db
    .update(plans)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      priceMonthlyCents: parsePriceToCents(String(formData.get("priceMonthly") ?? "0")),
      priceYearlyCents: parsePriceToCents(String(formData.get("priceYearly") ?? "0")),
      maxProducts: maxProductsRaw === "" ? null : Math.max(0, Number(maxProductsRaw)),
      maxBookingsMonth: maxBookingsRaw === "" ? null : Math.max(0, Number(maxBookingsRaw)),
      features,
    })
    .where(eq(plans.id, planId));

  revalidatePath("/admin/planes");
  revalidatePath("/");
  return { error: null, ok: "Plan guardado." };
}

export async function createPlanAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireSuperadmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(name);
  if (!name) return { error: "Pon un nombre al plan." };
  const exists = await db.select({ id: plans.id }).from(plans).where(eq(plans.slug, slug)).limit(1);
  if (exists.length) return { error: "Ya existe un plan con ese nombre." };

  await db.insert(plans).values({
    slug,
    name,
    priceMonthlyCents: parsePriceToCents(String(formData.get("priceMonthly") ?? "0")),
    priceYearlyCents: parsePriceToCents(String(formData.get("priceYearly") ?? "0")),
    features: { catalog: true, qr: true },
    sortOrder: 99,
  });
  revalidatePath("/admin/planes");
  return { error: null, ok: "Plan creado." };
}

export async function togglePlanActiveAction(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const planId = String(formData.get("planId") ?? "");
  await db
    .update(plans)
    .set({ active: sql`not ${plans.active}` })
    .where(eq(plans.id, planId));
  revalidatePath("/admin/planes");
}

/** El comercio pide activar el plan (no hay cobro real de suscripciones todavia). */
export async function requestActivationAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get("tenantId") ?? "");
  if (!tenantId) return;
  await db
    .update(tenants)
    .set({ activationRequested: true, activationRequestedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tenants.id, tenantId), eq(tenants.status, "trial")));
  await db.insert(events).values({ tenantId, type: "activation_requested", meta: {} });
  revalidatePath("/app/plan");
  revalidatePath("/admin");
}

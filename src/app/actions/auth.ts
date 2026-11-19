"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, events } from "@/db/schema";
import {
  createSession,
  destroySession,
  getSession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { clearLimit, peekLimit, recordFailure } from "@/lib/ratelimit";
import { config } from "@/lib/config";

export type FormState = { error: string | null; ok?: boolean };

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Escribe tu email y tu contraseña." };

  // Solo cuentan los intentos fallidos: un login correcto no bloquea la cuenta.
  const key = `login:${email}`;
  const gate = await peekLimit(key, 10);
  if (!gate.ok) {
    return { error: `Demasiados intentos. Prueba de nuevo en ${Math.ceil(gate.retryAfterMs / 60000)} minutos.` };
  }

  const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = found[0];
  // Mismo mensaje para usuario inexistente y contraseña incorrecta
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await recordFailure(key, 10 * 60_000);
    return { error: "Email o contraseña incorrectos." };
  }
  await clearLimit(key);

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id, user.tenantId ?? null);
  await db.insert(events).values({ tenantId: user.tenantId, type: "login", meta: { role: user.role } });

  if (user.mustChangePassword) redirect("/cuenta/contrasena");
  redirect(user.role === "superadmin" ? "/admin" : "/app");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function setupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const existing = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  if ((existing[0]?.n ?? 0) > 0) return { error: "La instalación ya está configurada. Ve a /login." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (!email.includes("@")) return { error: "Email no válido." };
  if (password.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres." };
  if (password !== repeat) return { error: "Las contraseñas no coinciden." };

  const inserted = await db
    .insert(users)
    .values({ email, passwordHash: hashPassword(password), role: "superadmin", tenantId: null })
    .returning();

  const user = inserted[0];
  await createSession(user.id, null);
  redirect("/admin");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (!verifyPassword(current, session.user.passwordHash)) return { error: "La contraseña actual no es correcta." };
  if (next.length < 10) return { error: "La nueva contraseña debe tener al menos 10 caracteres." };
  if (next !== repeat) return { error: "Las contraseñas nuevas no coinciden." };
  if (next === current) return { error: "La nueva contraseña debe ser distinta." };

  await db
    .update(users)
    .set({ passwordHash: hashPassword(next), mustChangePassword: false })
    .where(eq(users.id, session.user.id));

  redirect(session.user.role === "superadmin" ? "/admin" : "/app");
}

/** Permite crear el superadmin desde /setup solo si no hay usuarios. */
export async function hasAnyUser(): Promise<boolean> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return (rows[0]?.n ?? 0) > 0;
}

export async function currentEmail(): Promise<string> {
  const session = await getSession();
  return session?.user.email ?? config.adminEmail;
}

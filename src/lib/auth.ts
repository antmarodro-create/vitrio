import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./db";
import { sessions, tenants, users, type Tenant, type User } from "@/db/schema";
import { maybeRunLifecycle } from "./lifecycle";

const COOKIE_NAME = "vitrio_session";
const TTL_MS = 30 * 86_400_000; // 30 dias

/* ------------------------------ contrasenas ------------------------------ */

export { generateTempPassword, hashPassword, verifyPassword } from "./password";

/** El token de sesion se guarda hasheado: si se filtra la base de datos no sirve para entrar. */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/* -------------------------------- sesiones ------------------------------- */

export type SessionData = { user: User; tenant: Tenant | null };

export async function createSession(userId: string, tenantId: string | null, userAgent?: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    tenantId,
    expiresAt,
    userAgent: userAgent?.slice(0, 250) ?? null,
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(COOKIE_NAME);
}

/** Lee la sesion de la cookie. Devuelve null si no hay o si caduco. */
export async function getSession(): Promise<SessionData | null> {
  // Mantenimiento perezoso (trial/congelado/borrado) como maximo 1 vez/minuto.
  await maybeRunLifecycle();

  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  let tenant: Tenant | null = null;
  if (row.user.tenantId) {
    const found = await db.select().from(tenants).where(eq(tenants.id, row.user.tenantId)).limit(1);
    tenant = found[0] ?? null;
  }
  return { user: row.user, tenant };
}

export async function requireUser(): Promise<SessionData> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireSuperadmin(): Promise<{ user: User; tenant: null }> {
  const session = await requireUser();
  if (session.user.role !== "superadmin") redirect("/app");
  return { user: session.user, tenant: null };
}

export type TenantSession = { user: User; tenant: Tenant };

/** Comercio activo en trial o de pago. Si esta congelado, manda a /app/congelada. */
export async function requireTenant(): Promise<TenantSession> {
  const session = await requireUser();
  if (session.user.role === "superadmin") redirect("/admin");
  const tenant = session.tenant;
  if (!tenant || tenant.status === "deleted") {
    await destroySession();
    redirect("/login?error=cuenta-eliminada");
  }
  if (tenant.status === "frozen") redirect("/congelada");
  return { user: session.user, tenant };
}

/** Igual que requireTenant pero permite cuentas congeladas (para leer el estado). */
export async function requireTenantAnyStatus(): Promise<TenantSession> {
  const session = await requireUser();
  if (session.user.role === "superadmin") redirect("/admin");
  if (!session.tenant) redirect("/login");
  return { user: session.user, tenant: session.tenant };
}

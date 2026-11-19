import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Rate limiting.
 *
 * En local (una instancia) bastaria con memoria, pero en Netlify cada peticion
 * puede caer en una instancia distinta: los contadores se guardan en PostgreSQL
 * (tabla `rate_limits`). Si la base de datos falla, se degrada a memoria para no
 * tumbar la app.
 */

type Bucket = { count: number; resetAt: number };

const globalForLimit = globalThis as unknown as { __vitrioBuckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = globalForLimit.__vitrioBuckets ?? new Map();
globalForLimit.__vitrioBuckets = buckets;

/* ------------------------------- memoria ---------------------------------- */

function memoryConsume(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, count: 1, retryAfterMs: 0 };
  }
  bucket.count += 1;
  return { ok: bucket.count <= limit, count: bucket.count, retryAfterMs: bucket.count > limit ? bucket.resetAt - now : 0 };
}

function memoryPeek(key: string, limit: number) {
  const bucket = buckets.get(key);
  const now = Date.now();
  if (!bucket || bucket.resetAt <= now) return { ok: true, retryAfterMs: 0 };
  return { ok: bucket.count < limit, retryAfterMs: bucket.count >= limit ? bucket.resetAt - now : 0 };
}

/* -------------------------------- postgres -------------------------------- */

type Row = { count: number; reset_at: string };

function firstRow(result: unknown): Row | undefined {
  const maybe = result as { rows?: Row[] };
  return maybe.rows?.[0];
}

/** Consume una unidad de cuota. Devuelve ok=false si se ha superado el limite. */
export async function consumeLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterMs: number }> {
  const now = new Date();
  const resetAt = new Date(Date.now() + windowMs);
  try {
    const result = await db.execute(sql`
      insert into rate_limits (key, count, reset_at)
      values (${key}, 1, ${resetAt})
      on conflict (key) do update set
        count = case when rate_limits.reset_at <= ${now} then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at <= ${now} then ${resetAt} else rate_limits.reset_at end
      returning count, reset_at
    `);
    const row = firstRow(result);
    if (!row) return memoryConsume(key, limit, windowMs);
    const count = Number(row.count);
    const resetMs = new Date(row.reset_at).getTime();
    return { ok: count <= limit, retryAfterMs: count > limit ? Math.max(0, resetMs - Date.now()) : 0 };
  } catch (err) {
    console.error("[ratelimit] fallback a memoria", err);
    return memoryConsume(key, limit, windowMs);
  }
}

/** Consulta sin consumir (para no bloquear a un usuario legitimo). */
export async function peekLimit(key: string, limit: number): Promise<{ ok: boolean; retryAfterMs: number }> {
  try {
    const result = await db.execute(sql`select count, reset_at from rate_limits where key = ${key} limit 1`);
    const row = firstRow(result);
    if (!row) return { ok: true, retryAfterMs: 0 };
    const resetMs = new Date(row.reset_at).getTime();
    if (resetMs <= Date.now()) return { ok: true, retryAfterMs: 0 };
    const count = Number(row.count);
    return { ok: count < limit, retryAfterMs: count >= limit ? resetMs - Date.now() : 0 };
  } catch {
    return memoryPeek(key, limit);
  }
}

/** Anota un intento fallido. */
export async function recordFailure(key: string, windowMs: number): Promise<void> {
  const now = new Date();
  const resetAt = new Date(Date.now() + windowMs);
  try {
    await db.execute(sql`
      insert into rate_limits (key, count, reset_at)
      values (${key}, 1, ${resetAt})
      on conflict (key) do update set
        count = case when rate_limits.reset_at <= ${now} then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at <= ${now} then ${resetAt} else rate_limits.reset_at end
    `);
  } catch {
    memoryConsume(key, 10, windowMs);
  }
}

/** Limpia el contador (login correcto). */
export async function clearLimit(key: string): Promise<void> {
  buckets.delete(key);
  try {
    await db.execute(sql`delete from rate_limits where key = ${key}`);
  } catch {
    /* sin problema: caduca solo */
  }
}

/** Higiene: borra contadores caducados (se llama desde el ciclo de vida). */
export async function pruneLimits(): Promise<void> {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  await db.execute(sql`delete from rate_limits where reset_at < now()`).catch(() => undefined);
}

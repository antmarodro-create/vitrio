import crypto from "node:crypto";

/**
 * Hash de contrasenas con scrypt y sal aleatoria. Formato:
 * scrypt$N$r$p$sal$hash
 * Vive aparte de auth.ts para poder usarse en scripts (seed) sin Next.
 */
const SCRYPT_N = 16384;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64, { N: SCRYPT_N, r: 8, p: 1 }).toString("hex");
  return `scrypt$${SCRYPT_N}$8$1$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, n, r, p, salt, hash] = stored.split("$");
    if (algo !== "scrypt" || !salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, 64, { N: Number(n), r: Number(r), p: Number(p) });
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function generateTempPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

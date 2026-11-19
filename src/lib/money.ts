/** Importes: siempre en centimos (enteros) en la base de datos. */

export function formatEUR(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-ES").format(n);
}

/** "12,50" / "12.50" / "12" -> 1250 */
export function parsePriceToCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  const raw = String(input).replace(/\s|€/g, "").replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** IVA incluido: 21% por defecto */
export function ivaFromGross(cents: number, rate = 0.21): { base: number; iva: number; total: number } {
  const base = Math.round(cents / (1 + rate));
  return { base, iva: cents - base, total: cents };
}

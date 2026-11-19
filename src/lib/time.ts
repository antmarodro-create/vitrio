/**
 * Utilidades de fecha/hora con zona horaria del negocio (por defecto Europe/Madrid).
 * Todo se guarda en UTC (timestamptz) y se muestra en la zona del comercio.
 */

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function weekdayName(dayIndex: number): string {
  return WEEKDAYS[dayIndex] ?? "";
}

function partsInTz(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  // en-CA con hour12:false puede devolver 24 para medianoche
  const hour = p.hour === "24" ? "00" : p.hour;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

function tzOffsetMs(date: Date, tz: string): number {
  const p = partsInTz(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Convierte hora local del negocio a instante UTC. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let ts = naive - tzOffsetMs(new Date(naive), tz);
  ts = naive - tzOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

export function isoDateInTz(date: Date, tz: string): string {
  const p = partsInTz(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function hourInTz(date: Date, tz: string): number {
  return partsInTz(date, tz).hour;
}

/** Minutos desde medianoche en la zona del negocio. */
export function minutesInTz(date: Date, tz: string): number {
  const p = partsInTz(date, tz);
  return p.hour * 60 + p.minute;
}

/** 0 = domingo ... 6 = sabado */
export function weekdayInTz(date: Date, tz: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

export function formatDateTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateLong(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** "HH:MM" -> minutos desde medianoche */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Fecha de hoy en el negocio, como "YYYY-MM-DD" */
export function todayInTz(tz: string): string {
  return isoDateInTz(new Date(), tz);
}

/** Suma dias a una fecha "YYYY-MM-DD" sin depender de la zona del servidor. */
export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isoDateToWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatIsoDateLong(iso: string, tz: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const noon = zonedToUtc(y, m, d, 12, 0, tz);
  return formatDateLong(noon, tz);
}

export function formatIsoDateShort(iso: string, tz: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const noon = zonedToUtc(y, m, d, 12, 0, tz);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(noon);
}

/** Horarios semanales por defecto: dos tramos por dia laborable. */
export function defaultHours(): Record<string, string[][]> {
  const week: Record<string, string[][]> = {
    "0": [],
    "1": [["10:00", "14:00"], ["17:00", "21:00"]],
    "2": [["10:00", "14:00"], ["17:00", "21:00"]],
    "3": [["10:00", "14:00"], ["17:00", "21:00"]],
    "4": [["10:00", "14:00"], ["17:00", "21:00"]],
    "5": [["10:00", "14:00"], ["17:00", "21:00"]],
    "6": [["10:00", "14:00"], ["17:00", "21:00"]],
  };
  return week;
}

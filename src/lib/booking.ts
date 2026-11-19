import crypto from "node:crypto";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { appointments, events, products, type Appointment, type Plan, type Product, type Tenant } from "@/db/schema";
import {
  addMinutes,
  isoDateToWeekday,
  isoDateInTz,
  minutesInTz,
  minutesToTime,
  shiftIsoDate,
  timeToMinutes,
  todayInTz,
  zonedToUtc,
} from "./time";
import { BUSINESS_TYPES, type BusinessType } from "./plans";

const ACTIVE_STATUSES = ["pending", "confirmed"];

export function publicCode(): string {
  const alphabet = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function usesPartySize(tenant: Tenant): boolean {
  return Boolean(BUSINESS_TYPES[tenant.businessType as BusinessType]?.usesParty);
}

export function bookingLabel(tenant: Tenant): string {
  return BUSINESS_TYPES[tenant.businessType as BusinessType]?.bookingLabel ?? "Reserva";
}

/** Senal a cobrar. En bares se interpreta por persona; en servicios, por cita. */
export function bookingDepositCents(tenant: Tenant, product: Product | null, partySize: number): number {
  if (tenant.prepay === "none") return 0;
  if (tenant.prepay === "full") {
    if (product) return product.priceCents * (usesPartySize(tenant) ? partySize : 1);
    return tenant.depositCents * (usesPartySize(tenant) ? partySize : 1);
  }
  const base = product?.depositCents ?? tenant.depositCents;
  return base * (usesPartySize(tenant) ? Math.max(1, partySize) : 1);
}

export type AvailabilitySlot = {
  startIso: string;
  time: string;
  available: boolean;
  left: number;
};

export type AvailabilityResult = {
  slots: AvailabilitySlot[];
  services: Product[];
  reason?: string;
};

/** Reservas del mes en curso (para el limite del plan). */
export async function bookingsThisMonth(tenant: Tenant): Promise<number> {
  const day = todayInTz(tenant.timezone).slice(0, 7);
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenant.id),
        inArray(appointments.status, ["pending", "confirmed", "completed"]),
        sql`to_char(${appointments.startsAt} AT TIME ZONE ${tenant.timezone}, 'YYYY-MM') = ${day}`,
      ),
    );
  return rows[0]?.n ?? 0;
}

/**
 * Huecos de un dia. La capacidad cuenta comensales en bares y citas simultaneas
 * en servicios (opcionalmente por servicio).
 */
export async function getDayAvailability(opts: {
  tenant: Tenant;
  isoDate: string;
  productId?: string | null;
  partySize?: number;
  plan?: Plan | null;
}): Promise<AvailabilityResult> {
  const { tenant, isoDate } = opts;
  const tz = tenant.timezone;
  const services = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenant.id), eq(products.kind, "service"), eq(products.visible, true)));

  const product = opts.productId ? services.find((s) => s.id === opts.productId) ?? null : null;
  const duration = product?.durationMinutes ?? tenant.durationMinutes;
  const capacity = product?.capacity ?? tenant.capacity;
  const partySize = Math.max(1, opts.partySize ?? 1);

  if (tenant.status === "frozen" || tenant.status === "deleted") {
    return { slots: [], services, reason: "Este comercio no acepta reservas ahora mismo." };
  }
  if (opts.plan && opts.plan.maxBookingsMonth) {
    const used = await bookingsThisMonth(tenant);
    if (used >= opts.plan.maxBookingsMonth) {
      return { slots: [], services, reason: "Este mes no quedan reservas disponibles." };
    }
  }

  const weekday = String(isoDateToWeekday(isoDate));
  const segments = (tenant.hours?.[weekday] ?? []).filter((s) => Array.isArray(s) && s.length === 2);
  if (!segments.length) return { slots: [], services, reason: "Cerrado ese día." };

  const [y, m, d] = isoDate.split("-").map(Number);
  const dayStart = zonedToUtc(y, m, d, 0, 0, tz);
  const dayEnd = zonedToUtc(y, m, d, 23, 59, tz);

  const existing = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenant.id),
        inArray(appointments.status, ACTIVE_STATUSES),
        lt(appointments.startsAt, dayEnd),
        gte(appointments.endsAt, dayStart),
      ),
    );

  const booked = existing.filter((a) => !opts.productId || a.productId === opts.productId);
  const noticeCutoff = new Date(Date.now() + tenant.noticeMinutes * 60_000);
  const nowLimit = tenant.noticeMinutes >= 0 ? noticeCutoff : new Date();

  const slots: AvailabilitySlot[] = [];
  for (const [from, to] of segments) {
    const fromMin = timeToMinutes(from);
    const toMin = timeToMinutes(to);
    for (let cur = fromMin; cur + duration <= toMin; cur += tenant.slotMinutes) {
      const start = zonedToUtc(y, m, d, Math.floor(cur / 60), cur % 60, tz);
      const end = addMinutes(start, duration);
      if (start < nowLimit) continue;

      const overlapping = booked.filter((a) => a.startsAt < end && a.endsAt > start);
      const used = usesPartySize(tenant)
        ? overlapping.reduce((acc, a) => acc + a.partySize, 0)
        : overlapping.length;
      const needed = usesPartySize(tenant) ? partySize : 1;
      const left = Math.max(0, capacity - used);
      slots.push({
        startIso: start.toISOString(),
        time: minutesToTime(cur),
        available: left >= needed,
        left,
      });
    }
  }

  return { slots, services, reason: slots.length ? undefined : "No quedan huecos ese día." };
}

/** Dias con disponibilidad, para el selector de fecha del catalogo publico. */
export async function nextAvailableDays(tenant: Tenant, days = 14): Promise<string[]> {
  const today = todayInTz(tenant.timezone);
  const out: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const iso = shiftIsoDate(today, i);
    const weekday = String(isoDateToWeekday(iso));
    const segments = tenant.hours?.[weekday] ?? [];
    if (segments.length) out.push(iso);
  }
  return out;
}

export type CreateBookingInput = {
  tenant: Tenant;
  productId: string | null;
  startsAt: Date;
  partySize: number;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  plan?: Plan | null;
  source?: "online" | "manual";
  /** false si el comercio no puede cobrar online: la reserva se confirma sin señal */
  paymentsAvailable?: boolean;
};

export type CreateBookingResult =
  | { ok: true; appointment: Appointment; requiresPayment: boolean }
  | { ok: false; error: string };

/**
 * Inserta la reserva dentro de una transaccion con bloqueo por comercio
 * (pg_advisory_xact_lock) para evitar dobles reservas concurrentes.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { tenant } = input;
  const tz = tenant.timezone;

  if (!tenant.bookingsEnabled) return { ok: false, error: "Este comercio no acepta reservas online." };
  if (tenant.status === "frozen" || tenant.status === "deleted") {
    return { ok: false, error: "Este comercio no acepta reservas ahora mismo." };
  }

  const product = input.productId
    ? (
        await db
          .select()
          .from(products)
          .where(and(eq(products.id, input.productId), eq(products.tenantId, tenant.id)))
          .limit(1)
      )[0] ?? null
    : null;
  if (input.productId && !product) return { ok: false, error: "El servicio ya no está disponible." };

  const duration = product?.durationMinutes ?? tenant.durationMinutes;
  const capacity = product?.capacity ?? tenant.capacity;
  const partySize = Math.max(1, input.partySize);
  if (usesPartySize(tenant) && partySize > tenant.maxParty) {
    return { ok: false, error: `Máximo ${tenant.maxParty} personas por reserva.` };
  }

  const startsAt = input.startsAt;
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Fecha no válida." };
  if (startsAt.getTime() < Date.now() + tenant.noticeMinutes * 60_000 - 60_000) {
    return { ok: false, error: "Ese hueco ya no está disponible." };
  }
  const endsAt = addMinutes(startsAt, duration);

  // Comprueba que el hueco cae dentro del horario del negocio
  const isoDate = isoDateInTz(startsAt, tz);
  const weekday = String(isoDateToWeekday(isoDate));
  const segments = tenant.hours?.[weekday] ?? [];
  const minutes = minutesInTz(startsAt, tz);
  const inSchedule = segments.some(([from, to]) => minutes >= timeToMinutes(from) && minutes + duration <= timeToMinutes(to));
  if (!inSchedule) return { ok: false, error: "Ese horario no está dentro del horario de apertura." };

  // Sin cuenta de Stripe operativa no se puede pedir señal: se confirma sin prepago.
  const depositCents = input.paymentsAvailable ? bookingDepositCents(tenant, product, partySize) : 0;
  const requiresPayment = depositCents > 0;

  try {
    const appointment = await db.transaction(async (tx) => {
      // Serializa las reservas del comercio para no sobrepasar el aforo
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tenant.id}))`);

      const overlapping = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, tenant.id),
            inArray(appointments.status, ACTIVE_STATUSES),
            lt(appointments.startsAt, endsAt),
            gte(appointments.endsAt, startsAt),
          ),
        );

      const relevant = input.productId ? overlapping.filter((a) => a.productId === input.productId) : overlapping;
      const used = usesPartySize(tenant) ? relevant.reduce((acc, a) => acc + a.partySize, 0) : relevant.length;
      const needed = usesPartySize(tenant) ? partySize : 1;
      if (used + needed > capacity) {
        throw new Error("AFORO");
      }

      if (input.plan?.maxBookingsMonth) {
        const { n } = (
          await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(appointments)
            .where(
              and(
                eq(appointments.tenantId, tenant.id),
                inArray(appointments.status, ["pending", "confirmed", "completed"]),
                sql`to_char(${appointments.startsAt} AT TIME ZONE ${tz}, 'YYYY-MM') = ${isoDate.slice(0, 7)}`,
              ),
            )
        )[0] ?? { n: 0 };
        if (n >= input.plan.maxBookingsMonth) throw new Error("LIMITE");
      }

      const inserted = await tx
        .insert(appointments)
        .values({
          tenantId: tenant.id,
          productId: input.productId,
          customerName: input.name.trim().slice(0, 120),
          customerPhone: input.phone.trim().slice(0, 40),
          customerEmail: input.email?.trim().slice(0, 200) || null,
          partySize,
          startsAt,
          endsAt,
          // Por defecto la solicitud llega PENDIENTE: el comercio confirma desde su bandeja.
          // Solo se confirma sola si el comercio lo ha pedido expresamente y no hay pago.
          status: requiresPayment || !tenant.autoConfirmBookings ? "pending" : "confirmed",
          source: input.source ?? "online",
          code: publicCode(),
          depositCents,
          paymentStatus: requiresPayment ? "pending" : "none",
          notes: input.notes?.trim().slice(0, 500) || null,
        })
        .returning();

      const row = inserted[0];
      await tx.insert(events).values({
        tenantId: tenant.id,
        type: "booking_created",
        meta: { id: row.id, code: row.code, partySize, requiresPayment, source: row.source },
      });
      return row;
    });

    return { ok: true, appointment, requiresPayment };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "AFORO") return { ok: false, error: "Ese hueco se acaba de ocupar. Prueba con otra hora." };
    if (message === "LIMITE") return { ok: false, error: "El comercio ha alcanzado su límite mensual de reservas." };
    console.error("[booking] error", err);
    return { ok: false, error: "No se ha podido crear la reserva." };
  }
}

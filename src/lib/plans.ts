import type { Plan, Tenant } from "@/db/schema";

export const FEATURE_KEYS = [
  "catalog",
  "qr",
  "bookings",
  "orders",
  "payments",
  "whatsapp",
  "stats",
  "reviews",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, { label: string; description: string }> = {
  catalog: { label: "Catálogo online", description: "Productos y servicios con foto y precio" },
  qr: { label: "QR y cartel", description: "QR descargable para mesas y escaparate" },
  bookings: { label: "Reservas y citas", description: "Agenda, aforo y disponibilidad" },
  orders: { label: "Encargos", description: "Pedidos con recogida o entrega" },
  payments: { label: "Cobros online", description: "Señal o pago completo con tarjeta y Bizum" },
  whatsapp: { label: "WhatsApp", description: "Botones wa.me con mensaje preparado" },
  stats: { label: "Estadísticas", description: "Escaneos, reservas y ventas" },
  reviews: { label: "Reseñas de Google", description: "Enlace directo a la ficha (próximamente)" },
};

export const BUSINESS_TYPES = {
  bar: { label: "Bar / restaurante", bookingLabel: "Reserva de mesa", usesParty: true },
  beauty: { label: "Belleza / peluquería", bookingLabel: "Cita", usesParty: false },
  fashion: { label: "Moda / tienda", bookingLabel: "Cita", usesParty: false },
  services: { label: "Servicios", bookingLabel: "Cita", usesParty: false },
  shop: { label: "Tienda / obrador", bookingLabel: "Recogida", usesParty: false },
} as const;

export type BusinessType = keyof typeof BUSINESS_TYPES;

export function businessTypeLabel(type: string): string {
  return BUSINESS_TYPES[type as BusinessType]?.label ?? type;
}

export function planHas(plan: Plan | null | undefined, feature: FeatureKey): boolean {
  if (!plan) return false;
  return Boolean(plan.features?.[feature]);
}

export function tenantHasFeature(tenant: Tenant, plan: Plan | null, feature: FeatureKey): boolean {
  if (tenant.status === "frozen" || tenant.status === "deleted") return false;
  return planHas(plan, feature);
}

export const DEFAULT_PLANS = [
  {
    slug: "basico",
    name: "Básico",
    priceMonthlyCents: 1900,
    priceYearlyCents: 19000,
    maxProducts: 30,
    maxBookingsMonth: 0,
    sortOrder: 1,
    features: { catalog: true, qr: true, whatsapp: true, stats: true } as Record<string, boolean>,
  },
  {
    slug: "pro",
    name: "Pro",
    priceMonthlyCents: 3900,
    priceYearlyCents: 39000,
    maxProducts: 200,
    maxBookingsMonth: 300,
    sortOrder: 2,
    features: {
      catalog: true,
      qr: true,
      whatsapp: true,
      stats: true,
      bookings: true,
      orders: true,
      payments: true,
    } as Record<string, boolean>,
  },
  {
    slug: "premium",
    name: "Premium",
    priceMonthlyCents: 5900,
    priceYearlyCents: 59000,
    maxProducts: null,
    maxBookingsMonth: null,
    sortOrder: 3,
    features: {
      catalog: true,
      qr: true,
      whatsapp: true,
      stats: true,
      bookings: true,
      orders: true,
      payments: true,
      reviews: true,
    } as Record<string, boolean>,
  },
];

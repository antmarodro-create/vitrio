import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  bigserial,
} from "drizzle-orm/pg-core";

/**
 * Estados y valores cerrados se validan en la capa de servidor (zod + acciones),
 * no con CHECK ni enums, para que `drizzle-kit push` no deje restricciones
 * desincronizadas entre entornos.
 */

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  priceMonthlyCents: integer("price_monthly_cents").notNull().default(1900),
  priceYearlyCents: integer("price_yearly_cents").notNull().default(19000),
  /** { catalog, qr, bookings, orders, payments, whatsapp, stats, reviews } */
  features: jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
  /** null = sin limite */
  maxProducts: integer("max_products"),
  maxBookingsMonth: integer("max_bookings_month"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    /** bar | beauty | fashion | services */
    businessType: text("business_type").notNull().default("bar"),
    /** trial | active | frozen | deleted */
    status: text("status").notNull().default("trial"),
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
    ownerEmail: text("owner_email"),
    ownerName: text("owner_name"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    address: text("address"),
    city: text("city"),
    logoData: text("logo_data"),
    primaryColor: text("primary_color").notNull().default("#111827"),
    timezone: text("timezone").notNull().default("Europe/Madrid"),

    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    deleteAt: timestamp("delete_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),

    activationRequested: boolean("activation_requested").notNull().default(false),
    activationRequestedAt: timestamp("activation_requested_at", { withTimezone: true }),

    bookingsEnabled: boolean("bookings_enabled").notNull().default(false),
    ordersEnabled: boolean("orders_enabled").notNull().default(false),

    /** { "0": [["12:00","16:00"]], "1": [...], ... } 0 = domingo */
    hours: jsonb("hours").$type<Record<string, string[][]>>().notNull().default({}),
    slotMinutes: integer("slot_minutes").notNull().default(30),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    /** comensales simultaneos (bar) o citas simultaneas (servicios) */
    capacity: integer("capacity").notNull().default(4),
    maxParty: integer("max_party").notNull().default(8),
    noticeMinutes: integer("notice_minutes").notNull().default(120),

    /** none | deposit | full */
    prepay: text("prepay").notNull().default("none"),
    depositCents: integer("deposit_cents").notNull().default(0),
    orderNoticeHours: integer("order_notice_hours").notNull().default(2),

    paymentCardEnabled: boolean("payment_card_enabled").notNull().default(true),
    paymentBizumEnabled: boolean("payment_bizum_enabled").notNull().default(false),
    /**
     * Stripe Connect: cada comercio cobra en SU cuenta (cargo directo).
     * Vitrio nunca toca el dinero de las ventas; solo factura su cuota aparte.
     */
    stripeAccountId: text("stripe_account_id"),
    stripeChargesEnabled: boolean("stripe_charges_enabled").notNull().default(false),
    stripeDetailsSubmitted: boolean("stripe_details_submitted").notNull().default(false),
    stripeConnectedAt: timestamp("stripe_connected_at", { withTimezone: true }),
    policyText: text("policy_text"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tenants_status_idx").on(t.status)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    /** superadmin | owner | staff */
    role: text("role").notNull().default("owner"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_tenant_idx").on(t.tenantId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** product | service */
    kind: text("kind").notNull().default("product"),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull().default(0),
    category: text("category"),
    durationMinutes: integer("duration_minutes"),
    /** aforo simultaneo del servicio */
    capacity: integer("capacity"),
    depositCents: integer("deposit_cents"),
    imageData: text("image_data"),
    visible: boolean("visible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_tenant_idx").on(t.tenantId, t.kind)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    partySize: integer("party_size").notNull().default(1),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** pending | confirmed | cancelled | completed */
    status: text("status").notNull().default("pending"),
    /** online | manual */
    source: text("source").notNull().default("online"),
    code: text("code").notNull().unique(),
    depositCents: integer("deposit_cents").notNull().default(0),
    /** none | unpaid | pending | paid | refunded */
    paymentStatus: text("payment_status").notNull().default("none"),
    stripeSessionId: text("stripe_session_id"),
    /** cuenta conectada del comercio que ha cobrado (cargo directo) */
    stripeAccountId: text("stripe_account_id"),
    paymentMethod: text("payment_method"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("appointments_tenant_start_idx").on(t.tenantId, t.startsAt)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    /** pickup | delivery */
    mode: text("mode").notNull().default("pickup"),
    pickupAt: timestamp("pickup_at", { withTimezone: true }),
    /** pending_payment | new | preparing | ready | completed | cancelled */
    status: text("status").notNull().default("new"),
    totalCents: integer("total_cents").notNull().default(0),
    /** none | unpaid | pending | paid | refunded */
    paymentStatus: text("payment_status").notNull().default("none"),
    stripeSessionId: text("stripe_session_id"),
    stripeAccountId: text("stripe_account_id"),
    paymentMethod: text("payment_method"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_tenant_idx").on(t.tenantId, t.status)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    qty: integer("qty").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id"),
    /** qr_scan | booking_created | order_created | payment_paid | login | trial_frozen ... */
    type: text("type").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_type_idx").on(t.type, t.createdAt)],
);

/**
 * Rate limiting persistente: en Netlify (serverless) cada peticion puede caer en
 * una instancia distinta, asi que los contadores viven en PostgreSQL.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Plan = typeof plans.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

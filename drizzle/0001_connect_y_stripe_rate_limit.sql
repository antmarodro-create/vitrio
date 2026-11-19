CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_charges_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_details_submitted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_connected_at" timestamp with time zone;
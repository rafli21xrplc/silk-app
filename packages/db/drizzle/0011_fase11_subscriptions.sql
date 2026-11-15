-- Fase 11: langganan mitra dan pembayaran Duitku (POP), di balik flag subscriptions_enabled.
-- Tabel baru; tidak mengubah tabel terbit. Tidak ada query pencarian publik yang membaca tabel ini (aturan mutlak 1).
-- Rencana mundur: DROP TABLE subscriptions; DROP TABLE payment_events; DROP TABLE payment_orders; DROP TYPE payment_status;
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" uuid,
	"merchant_order_id" text,
	"kind" text NOT NULL,
	"signature_valid" boolean,
	"outcome" text NOT NULL,
	"payload" jsonb NOT NULL,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid,
	"created_by" uuid,
	"merchant_order_id" text NOT NULL,
	"plan" text NOT NULL,
	"months" smallint NOT NULL,
	"amount" bigint NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'duitku' NOT NULL,
	"provider_mode" text NOT NULL,
	"provider_reference" text,
	"payment_url" text,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_orders_merchant_order_id_unique" UNIQUE("merchant_order_id"),
	CONSTRAINT "payment_orders_amount_positive" CHECK ("payment_orders"."amount" > 0),
	CONSTRAINT "payment_orders_months_positive" CHECK ("payment_orders"."months" > 0),
	CONSTRAINT "payment_orders_paid_at" CHECK (("payment_orders"."status" = 'paid') = ("payment_orders"."paid_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"payment_order_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_payment_order_id_unique" UNIQUE("payment_order_id"),
	CONSTRAINT "subscriptions_period" CHECK ("subscriptions"."ends_at" > "subscriptions"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payment_order_id_payment_orders_id_fk" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_events_order_idx" ON "payment_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_orders_partner_idx" ON "payment_orders" USING btree ("partner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payment_orders_pending_idx" ON "payment_orders" USING btree ("status","created_at") WHERE "payment_orders"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "subscriptions_partner_idx" ON "subscriptions" USING btree ("partner_id","ends_at" DESC NULLS LAST);
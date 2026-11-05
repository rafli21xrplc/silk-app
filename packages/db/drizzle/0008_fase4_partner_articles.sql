-- Fase 4 (F-05): artikel edukasi dari mitra. Tabel dan enum baru; tidak mengubah tabel terbit.
-- Rencana mundur: DROP TABLE partner_articles; DROP TYPE article_status;
CREATE TYPE "public"."article_status" AS ENUM('draft', 'pending', 'published', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TABLE "partner_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"author_user_id" uuid,
	"slug" citext NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"published_title" text,
	"published_summary" text,
	"published_body" text,
	"first_published_at" timestamp with time zone,
	"published_updated_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"rejection_reason" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"withdrawn_reason" text,
	"withdrawn_at" timestamp with time zone,
	"declaration_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_articles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "partner_articles_published_together" CHECK (("partner_articles"."published_title" IS NULL) = ("partner_articles"."published_body" IS NULL) AND ("partner_articles"."published_summary" IS NULL) = ("partner_articles"."published_body" IS NULL)
        AND ("partner_articles"."published_body" IS NULL) = ("partner_articles"."first_published_at" IS NULL)),
	CONSTRAINT "partner_articles_published_status" CHECK ("partner_articles"."status" <> 'published' OR ("partner_articles"."published_body" IS NOT NULL AND "partner_articles"."withdrawn_at" IS NULL)),
	CONSTRAINT "partner_articles_withdrawn_at" CHECK ("partner_articles"."status" <> 'withdrawn' OR "partner_articles"."withdrawn_at" IS NOT NULL),
	CONSTRAINT "partner_articles_rejection_reason" CHECK ("partner_articles"."status" <> 'rejected' OR "partner_articles"."rejection_reason" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "partner_articles" ADD CONSTRAINT "partner_articles_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_articles" ADD CONSTRAINT "partner_articles_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_articles" ADD CONSTRAINT "partner_articles_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_articles_queue_idx" ON "partner_articles" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "partner_articles_partner_idx" ON "partner_articles" USING btree ("partner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "partner_articles_public_idx" ON "partner_articles" USING btree ("published_updated_at" DESC NULLS LAST) WHERE "partner_articles"."published_body" IS NOT NULL;
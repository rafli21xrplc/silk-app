-- Evaluasi USP R8 (Fase 6 ramping): ulasan pengalaman per profil, di balik flag reviews_enabled.
-- Tabel baru; tidak mengubah tabel terbit. Ringkasan rating tetap di facility_ratings (Fase 3).
-- Rencana mundur: DROP TABLE reviews; DELETE FROM facility_ratings;
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"author_id" uuid,
	"rating" smallint NOT NULL,
	"aspects" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"comment" text,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"declaration_version" text NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "reviews_aspects_object" CHECK (jsonb_typeof("reviews"."aspects") = 'object'),
	CONSTRAINT "reviews_sample_author" CHECK ("reviews"."is_sample" = ("reviews"."author_id" IS NULL)),
	CONSTRAINT "reviews_rejection_reason" CHECK ("reviews"."status" <> 'rejected' OR "reviews"."rejection_reason" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_author_facility" ON "reviews" USING btree ("author_id","facility_id") WHERE "reviews"."author_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "reviews_facility_idx" ON "reviews" USING btree ("facility_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reviews_queue_idx" ON "reviews" USING btree ("status","updated_at");
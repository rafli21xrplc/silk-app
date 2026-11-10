-- Evaluasi USP R6: persetujuan tertulis orang yang tampil di video profil. Tabel dan enum baru;
-- tidak mengubah tabel terbit. Video tanpa persetujuan aktif tidak tampil publik (disaring di query).
-- Rencana mundur: DROP TABLE media_consents; DROP TYPE consent_method;
CREATE TYPE "public"."consent_method" AS ENUM('pernyataan_akun', 'dokumen');--> statement-breakpoint
CREATE TABLE "media_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid,
	"facility_id" uuid NOT NULL,
	"subject_name" text NOT NULL,
	"method" "consent_method" NOT NULL,
	"scopes" text[] NOT NULL,
	"text_version" text NOT NULL,
	"document_object_key" text,
	"document_file_name" text,
	"document_mime" text,
	"document_size_bytes" integer,
	"document_confirmed_at" timestamp with time zone,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text,
	CONSTRAINT "media_consents_document_object_key_unique" UNIQUE("document_object_key"),
	CONSTRAINT "media_consents_scopes" CHECK (cardinality("media_consents"."scopes") >= 1 AND "media_consents"."scopes" <@ ARRAY['profil_web','media_sosial']::text[] AND 'profil_web' = ANY("media_consents"."scopes")),
	CONSTRAINT "media_consents_document" CHECK (("media_consents"."method" = 'dokumen') = ("media_consents"."document_object_key" IS NOT NULL)),
	CONSTRAINT "media_consents_revoked" CHECK ("media_consents"."revoked_at" IS NULL OR "media_consents"."revoke_reason" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "media_consents" ADD CONSTRAINT "media_consents_media_id_profile_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."profile_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_consents" ADD CONSTRAINT "media_consents_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_consents" ADD CONSTRAINT "media_consents_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_consents" ADD CONSTRAINT "media_consents_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_consents_active_media" ON "media_consents" USING btree ("media_id") WHERE "media_consents"."revoked_at" IS NULL AND "media_consents"."media_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "media_consents_facility_idx" ON "media_consents" USING btree ("facility_id");
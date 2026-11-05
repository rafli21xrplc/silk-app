-- Fase 1 (F-01): role pasien dan mitra, tabel partners, kunci JWT, kolom phone.
-- Rencana mundur (tanpa kehilangan data lain):
--   DROP TABLE partners; DROP TABLE jwks; DROP TYPE partner_status; DROP TYPE partner_type;
--   ALTER TABLE "user" DROP COLUMN phone; ALTER TABLE "user" ALTER COLUMN role SET DEFAULT 'faskes';
--   Pengguna dengan role baru (pasien/tenaga_medis/gaya_hidup/apotek) perlu dipetakan manual sebelum mundur.
CREATE TYPE "public"."partner_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."partner_type" AS ENUM('fasilitas', 'tenaga_medis', 'gaya_hidup', 'apotek');--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"alg" text,
	"crv" text
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"partner_type" "partner_type" NOT NULL,
	"business_name" text NOT NULL,
	"license_no" text,
	"status" "partner_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"specialty" text,
	"str_no" text,
	"practitioner_id" uuid,
	"facility_kind" "facility_type",
	"room_count" integer,
	"field" text,
	"sia_no" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "partners_type_attributes" CHECK (("partners"."partner_type" <> 'tenaga_medis' OR "partners"."str_no" IS NOT NULL)
        AND ("partners"."partner_type" <> 'fasilitas' OR "partners"."facility_kind" IS NOT NULL)
        AND ("partners"."partner_type" <> 'gaya_hidup' OR "partners"."field" IS NOT NULL)
        AND ("partners"."partner_type" <> 'apotek' OR "partners"."sia_no" IS NOT NULL)),
	CONSTRAINT "partners_verified_at" CHECK (("partners"."status" = 'verified') = ("partners"."verified_at" IS NOT NULL)),
	CONSTRAINT "partners_rejection_reason" CHECK ("partners"."status" <> 'rejected' OR "partners"."rejection_reason" IS NOT NULL),
	CONSTRAINT "partners_room_count" CHECK ("partners"."room_count" IS NULL OR "partners"."room_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'pasien';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partners_status_type_idx" ON "partners" USING btree ("status","partner_type","created_at");
--> statement-breakpoint
-- Data: pengelola faskes lama yang sudah punya keanggotaan menjadi mitra fasilitas terverifikasi.
-- verified_at = waktu klaim disetujui (atau waktu keanggotaan dibuat bila tidak ada klaim). Idempoten.
INSERT INTO "partners" ("user_id", "partner_type", "business_name", "license_no", "status", "verified_at", "facility_kind")
SELECT DISTINCT ON (m."user_id")
  m."user_id", 'fasilitas', f."name", f."license_no", 'verified',
  COALESCE(
    (SELECT max(c."reviewed_at") FROM "facility_claims" c
      WHERE c."user_id" = m."user_id" AND c."facility_id" = m."facility_id" AND c."status" = 'disetujui'),
    m."created_at"
  ),
  f."type"
FROM "memberships" m
JOIN "facilities" f ON f."id" = m."facility_id"
JOIN "user" u ON u."id" = m."user_id"
WHERE u."role" = 'faskes'
ORDER BY m."user_id", m."created_at"
ON CONFLICT ("user_id") DO NOTHING;

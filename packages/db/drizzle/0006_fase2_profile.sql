-- Fase 2 (F-02): profil layanan (lokasi, jadwal, media), revisi profil, permintaan harga,
-- layanan aktif/nonaktif, jenis profil gaya_hidup dan rumah_duka.
-- Rencana mundur (data Fase 2 hilang, data lain aman):
--   CREATE OR REPLACE VIEW published_tariffs ... (definisi 0003, tanpa "AND t.active");
--   ALTER TABLE documents DROP CONSTRAINT documents_one_parent; ALTER TABLE documents DROP COLUMN tariff_change_request_id;
--   (hapus dulu baris documents tanpa claim_id) ALTER TABLE documents ALTER COLUMN claim_id SET NOT NULL;
--   ALTER TABLE tariffs DROP COLUMN active;
--   DROP TABLE tariff_change_requests, profile_revisions, profile_media, schedules, profile_locations;
--   DROP TYPE tariff_request_kind, schedule_kind, review_status, media_kind;
--   Nilai enum facility_type 'gaya_hidup'/'rumah_duka' tidak bisa dihapus Postgres; biarkan (tidak berbahaya)
--   atau buat ulang tipe bila tidak ada baris yang memakainya.
CREATE TYPE "public"."media_kind" AS ENUM('foto', 'video');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."schedule_kind" AS ENUM('operasional', 'praktik');--> statement-breakpoint
CREATE TYPE "public"."tariff_request_kind" AS ENUM('tunggal', 'impor');--> statement-breakpoint
ALTER TYPE "public"."facility_type" ADD VALUE 'gaya_hidup';--> statement-breakpoint
ALTER TYPE "public"."facility_type" ADD VALUE 'rumah_duka';--> statement-breakpoint
CREATE TABLE "profile_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"label" text,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"region_id" integer,
	"location" geography(Point, 4326) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"duration_sec" integer,
	"caption" text,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"public_url" text,
	"uploaded_by" uuid,
	"confirmed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_media_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "profile_media_rejection_reason" CHECK ("profile_media"."status" <> 'rejected' OR "profile_media"."rejection_reason" IS NOT NULL),
	CONSTRAINT "profile_media_public_url" CHECK ("profile_media"."status" = 'approved' OR "profile_media"."public_url" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "profile_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"submitted_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_revisions_rejection_reason" CHECK ("profile_revisions"."status" <> 'rejected' OR "profile_revisions"."rejection_reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"practitioner_id" uuid,
	"kind" "schedule_kind" NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"note" text,
	CONSTRAINT "schedules_weekday" CHECK ("schedules"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "schedules_time_order" CHECK ("schedules"."end_time" > "schedules"."start_time")
);
--> statement-breakpoint
CREATE TABLE "tariff_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"kind" "tariff_request_kind" NOT NULL,
	"tariff_id" uuid,
	"service_id" uuid,
	"package_payload" jsonb,
	"import_batch_id" uuid,
	"base_version_no" integer,
	"price_type" "price_type",
	"price_min" bigint,
	"price_max" bigint,
	"effective_from" date,
	"effective_to" date,
	"inclusions" text,
	"exclusions" text,
	"source_title" text NOT NULL,
	"source_url" text,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"submitted_by" uuid,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"rejection_reason" text,
	"resulting_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tariff_change_requests_kind_fields" CHECK (("tariff_change_requests"."kind" = 'tunggal' AND "tariff_change_requests"."service_id" IS NOT NULL AND "tariff_change_requests"."price_type" IS NOT NULL AND "tariff_change_requests"."effective_from" IS NOT NULL)
        OR ("tariff_change_requests"."kind" = 'impor' AND "tariff_change_requests"."import_batch_id" IS NOT NULL)),
	CONSTRAINT "tariff_change_requests_price_order" CHECK ("tariff_change_requests"."price_max" IS NULL OR "tariff_change_requests"."price_max" >= "tariff_change_requests"."price_min"),
	CONSTRAINT "tariff_change_requests_rejection_reason" CHECK ("tariff_change_requests"."status" <> 'rejected' OR "tariff_change_requests"."rejection_reason" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "claim_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "tariff_change_request_id" uuid;--> statement-breakpoint
ALTER TABLE "tariffs" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_locations" ADD CONSTRAINT "profile_locations_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_locations" ADD CONSTRAINT "profile_locations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_media" ADD CONSTRAINT "profile_media_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_media" ADD CONSTRAINT "profile_media_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_media" ADD CONSTRAINT "profile_media_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_revisions" ADD CONSTRAINT "profile_revisions_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_revisions" ADD CONSTRAINT "profile_revisions_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_revisions" ADD CONSTRAINT "profile_revisions_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_change_requests" ADD CONSTRAINT "tariff_change_requests_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_change_requests" ADD CONSTRAINT "tariff_change_requests_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_change_requests" ADD CONSTRAINT "tariff_change_requests_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_change_requests" ADD CONSTRAINT "tariff_change_requests_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_change_requests" ADD CONSTRAINT "tariff_change_requests_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_change_requests" ADD CONSTRAINT "tariff_change_requests_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_change_requests" ADD CONSTRAINT "tariff_change_requests_resulting_version_id_tariff_versions_id_fk" FOREIGN KEY ("resulting_version_id") REFERENCES "public"."tariff_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_locations_facility_idx" ON "profile_locations" USING btree ("facility_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_locations_one_primary" ON "profile_locations" USING btree ("facility_id") WHERE "profile_locations"."is_primary";--> statement-breakpoint
CREATE INDEX "profile_locations_location_gix" ON "profile_locations" USING gist ("location");--> statement-breakpoint
CREATE INDEX "profile_media_facility_idx" ON "profile_media" USING btree ("facility_id","kind","sort_order");--> statement-breakpoint
CREATE INDEX "profile_media_queue_idx" ON "profile_media" USING btree ("status","created_at") WHERE "profile_media"."confirmed_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_revisions_one_pending" ON "profile_revisions" USING btree ("facility_id") WHERE "profile_revisions"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "profile_revisions_queue_idx" ON "profile_revisions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "schedules_facility_idx" ON "schedules" USING btree ("facility_id","weekday");--> statement-breakpoint
CREATE INDEX "tariff_change_requests_queue_idx" ON "tariff_change_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "tariff_change_requests_facility_idx" ON "tariff_change_requests" USING btree ("facility_id","created_at");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tariff_change_request_id_tariff_change_requests_id_fk" FOREIGN KEY ("tariff_change_request_id") REFERENCES "public"."tariff_change_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_tariff_request_idx" ON "documents" USING btree ("tariff_change_request_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_one_parent" CHECK (num_nonnulls("documents"."claim_id", "documents"."tariff_change_request_id") = 1);
--> statement-breakpoint
-- Batas tarif terbit tetap satu definisi: tambah syarat layanan aktif (K5).
CREATE OR REPLACE VIEW published_tariffs AS
SELECT
  t.id AS tariff_id,
  t.facility_id,
  t.service_id,
  t.package_id,
  v.id AS version_id,
  v.version_no,
  v.price_type,
  v.price_min,
  v.price_max,
  v.effective_from,
  v.effective_to,
  v.verified_at,
  v.verification,
  v.source_id,
  v.inclusions,
  v.exclusions
FROM tariffs t
JOIN facilities f ON f.id = t.facility_id AND f.status = 'terbit'
JOIN LATERAL (
  SELECT tv.*
  FROM tariff_versions tv
  WHERE tv.tariff_id = t.id
    AND tv.effective_from <= (now() AT TIME ZONE 'Asia/Jakarta')::date
  ORDER BY tv.effective_from DESC, tv.version_no DESC
  LIMIT 1
) v ON true
WHERE t.status = 'terbit'
  AND t.active
  AND (v.effective_to IS NULL OR v.effective_to >= (now() AT TIME ZONE 'Asia/Jakarta')::date);
--> statement-breakpoint
-- Data: setiap faskes yang sudah ada mendapat satu lokasi utama dari kolomnya sekarang. Idempoten.
INSERT INTO profile_locations (facility_id, address, city, province, region_id, location, is_primary)
SELECT f.id, f.address, f.city, f.province, f.region_id, f.location, true
FROM facilities f
WHERE f.location IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profile_locations l WHERE l.facility_id = f.id);

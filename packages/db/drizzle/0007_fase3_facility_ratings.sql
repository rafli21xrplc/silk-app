-- Fase 3 (F-03, P5): ringkasan rating per profil, kosong sampai Fase 6 mengisinya.
-- Tidak mengubah tabel terbit maupun VIEW published_tariffs.
-- Rencana mundur: DROP TABLE facility_ratings;
CREATE TABLE "facility_ratings" (
	"facility_id" uuid PRIMARY KEY NOT NULL,
	"rating_avg" numeric(2, 1) NOT NULL,
	"rating_count" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_ratings_avg_range" CHECK ("facility_ratings"."rating_avg" BETWEEN 1 AND 5),
	CONSTRAINT "facility_ratings_count" CHECK ("facility_ratings"."rating_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "facility_ratings" ADD CONSTRAINT "facility_ratings_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
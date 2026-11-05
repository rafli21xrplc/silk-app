-- tariff_versions bersifat append-only (A7, bagian 4 "Aturan data").
-- Trigger berlaku untuk semua peran, termasuk pemilik tabel. TRUNCATE (dipakai uji) tidak terpengaruh.
-- Rencana mundur: DROP TRIGGER tariff_versions_append_only ON tariff_versions; DROP FUNCTION silk_forbid_tariff_version_mutation();
CREATE OR REPLACE FUNCTION silk_forbid_tariff_version_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'tariff_versions bersifat append-only: % ditolak, buat versi baru', TG_OP
    USING ERRCODE = '42501';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER tariff_versions_append_only
  BEFORE UPDATE OR DELETE ON tariff_versions
  FOR EACH ROW EXECUTE FUNCTION silk_forbid_tariff_version_mutation();

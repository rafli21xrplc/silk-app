-- Definisi tunggal "tarif terbit" (bagian 4, "Aturan data").
-- Versi yang tampil = versi dengan tanggal berlaku paling akhir yang sudah dimulai (effective_from <= hari ini WIB)
-- dan belum berakhir. Ralat dengan tanggal berlaku sama: nomor versi tertinggi menang.
-- Rencana mundur: DROP VIEW published_tariffs;
CREATE VIEW published_tariffs AS
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
  AND (v.effective_to IS NULL OR v.effective_to >= (now() AT TIME ZONE 'Asia/Jakarta')::date);

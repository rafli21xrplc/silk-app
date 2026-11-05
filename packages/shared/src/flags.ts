/**
 * Feature flag fitur berisiko hukum (prompt enablement, bagian "FEATURE FLAG"). Default OFF di semua
 * environment; dinyalakan lewat env `FEATURE_FLAGS` (dipisah koma) dan hanya dibaca di server.
 * Saat OFF: endpoint 404, UI tidak menampilkan apa pun, job tidak berjalan.
 */
export const FEATURE_FLAGS = [
  'reviews_enabled',
  'ai_chat_enabled',
  'health_records_enabled',
  'pharmacy_catalog_enabled',
  'pharmacy_orders_enabled',
  'subscriptions_enabled',
] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** Parse `FEATURE_FLAGS`. Nama yang tidak dikenal dilaporkan agar salah ketik tidak diam-diam diabaikan. */
export function parseFeatureFlags(raw: string | undefined): { enabled: ReadonlySet<FeatureFlag>; unknown: string[] } {
  const enabled = new Set<FeatureFlag>();
  const unknown: string[] = [];
  for (const name of (raw ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    if ((FEATURE_FLAGS as readonly string[]).includes(name)) enabled.add(name as FeatureFlag);
    else unknown.push(name);
  }
  return { enabled, unknown };
}

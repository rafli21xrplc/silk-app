import 'server-only';
import { parseFeatureFlags, type FeatureFlag } from '@silk/shared';

/**
 * Flag fitur dibaca di server web dari env `FEATURE_FLAGS` yang sama dengan API (default semua OFF).
 * Hanya untuk tampilan; penegakan tetap di API (404 saat OFF).
 */
export function featureEnabled(flag: FeatureFlag): boolean {
  return parseFeatureFlags(process.env.FEATURE_FLAGS).enabled.has(flag);
}

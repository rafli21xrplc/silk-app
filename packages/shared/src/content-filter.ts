import type { ContentRuleKind, ContentRuleLevel } from './constants';

export interface ContentRule {
  id: number | string;
  pattern: string;
  kind: ContentRuleKind;
  level: ContentRuleLevel;
}

export interface ContentViolation {
  ruleId: number | string;
  pattern: string;
  level: ContentRuleLevel;
  match: string;
  field?: string;
}

export interface ContentCheckResult {
  /** Ada aturan `blokir` yang cocok: tolak penerbitan. */
  blocked: boolean;
  /** Hanya aturan `tinjau` yang cocok: kirim ke moderator. */
  needsReview: boolean;
  violations: ContentViolation[];
}

/** Huruf kecil, buang diakritik, rapikan spasi. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regex untuk aturan; kata dicocokkan utuh (tidak di tengah kata lain). */
export function compileRule(rule: Pick<ContentRule, 'pattern' | 'kind'>): RegExp {
  if (rule.kind === 'regex') return new RegExp(rule.pattern, 'giu');
  const phrase = normalizeText(rule.pattern)
    .split(' ')
    .map(escapeRegex)
    .join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, 'giu');
}

/** Validasi pola sebelum disimpan admin. Mengembalikan pesan galat atau null. */
export function validateRulePattern(rule: Pick<ContentRule, 'pattern' | 'kind'>): string | null {
  try {
    compileRule(rule);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Pola tidak valid';
  }
}

/** Periksa beberapa bidang teks sekaligus terhadap aturan (M17). */
export function checkContent(
  fields: Record<string, string | null | undefined>,
  rules: readonly ContentRule[],
): ContentCheckResult {
  const violations: ContentViolation[] = [];
  for (const [field, raw] of Object.entries(fields)) {
    if (!raw) continue;
    const text = normalizeText(raw);
    for (const rule of rules) {
      let re: RegExp;
      try {
        re = compileRule(rule);
      } catch {
        continue; // pola rusak tidak boleh mematikan seluruh pemeriksaan
      }
      const m = re.exec(text);
      if (m) violations.push({ ruleId: rule.id, pattern: rule.pattern, level: rule.level, match: m[0], field });
    }
  }
  const blocked = violations.some((v) => v.level === 'blokir');
  return { blocked, needsReview: !blocked && violations.length > 0, violations };
}

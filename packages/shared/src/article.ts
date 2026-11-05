/**
 * Isi artikel mitra (Fase 4, A5): Markdown terbatas → blok berbentuk Portable Text yang sama dengan
 * artikel Sanity, sehingga renderer web dipakai ulang. Tanpa HTML, tautan, atau gambar: semua yang
 * tidak dikenali tampil sebagai teks biasa.
 *
 * Didukung: paragraf (dipisah baris kosong), `## ` / `### ` subjudul (`# ` dibaca sebagai `## `),
 * `- ` / `* ` daftar, `1. ` daftar bernomor, `> ` kutipan, `**tebal**`, `*miring*` / `_miring_`.
 */
export type ArticleMark = 'strong' | 'em';
export interface ArticleSpan {
  _key: string;
  text: string;
  marks: ArticleMark[];
}
export interface ArticleBlock {
  _type: 'block';
  _key: string;
  style: 'normal' | 'h2' | 'h3' | 'blockquote';
  listItem?: 'bullet' | 'number';
  children: ArticleSpan[];
}

const INLINE = /(\*\*[^*\n]+?\*\*|\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)/g;

function spans(text: string, key: string): ArticleSpan[] {
  const out: ArticleSpan[] = [];
  const push = (t: string, marks: ArticleMark[]) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.marks.join() === marks.join()) last.text += t;
    else out.push({ _key: `${key}s${out.length}`, text: t, marks });
  };
  for (const part of text.split(INLINE)) {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) push(part.slice(2, -2), ['strong']);
    else if (part.length > 2 && ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))))
      push(part.slice(1, -1), ['em']);
    else push(part, []);
  }
  return out.length ? out : [{ _key: `${key}s0`, text: '', marks: [] }];
}

type Pending = { style: ArticleBlock['style']; listItem?: ArticleBlock['listItem']; lines: string[] };

export function parseArticleBody(source: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let cur: Pending | null = null;
  const flush = () => {
    if (!cur) return;
    const text = cur.lines.join(' ').replace(/\s+/g, ' ').trim();
    if (text) {
      const key = `b${blocks.length}`;
      blocks.push({ _type: 'block', _key: key, style: cur.style, ...(cur.listItem ? { listItem: cur.listItem } : {}), children: spans(text, key) });
    }
    cur = null;
  };
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flush();
      cur = { style: m[1] === '###' ? 'h3' : 'h2', lines: [m[2]!] };
      flush();
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      flush();
      cur = { style: 'normal', listItem: 'bullet', lines: [m[1]!] };
    } else if ((m = line.match(/^\d{1,3}[.)]\s+(.*)$/))) {
      flush();
      cur = { style: 'normal', listItem: 'number', lines: [m[1]!] };
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      if (cur?.style !== 'blockquote') flush();
      cur ??= { style: 'blockquote', lines: [] };
      cur.lines.push(m[1]!);
    } else {
      // Baris lanjutan: menyambung paragraf, butir daftar, atau kutipan yang sedang terbuka.
      if (cur && (cur.style === 'h2' || cur.style === 'h3')) flush();
      cur ??= { style: 'normal', lines: [] };
      cur.lines.push(line);
    }
  }
  flush();
  return blocks;
}

/** Teks polos dari blok (untuk filter M17 dan estimasi waktu baca). */
export function articleBlocksToText(blocks: ArticleBlock[]): string {
  return blocks.map((b) => b.children.map((c) => c.text).join('')).join('\n');
}

/** Teks polos langsung dari sumber Markdown terbatas. */
export const articlePlainText = (source: string): string => articleBlocksToText(parseArticleBody(source));

/** Menit baca (±1.100 karakter per menit, minimal 1), sama dengan rumus artikel Sanity. */
export const articleReadingMinutes = (source: string): number => Math.max(1, Math.round(articlePlainText(source).length / 1100));

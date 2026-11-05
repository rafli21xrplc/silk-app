import { describe, expect, it } from 'vitest';
import { articlePlainText, articleReadingMinutes, parseArticleBody } from './article';

const simple = (src: string) =>
  parseArticleBody(src).map((b) => ({ style: b.style, list: b.listItem ?? null, text: b.children.map((c) => (c.marks.length ? `[${c.marks.join()}:${c.text}]` : c.text)).join('') }));

describe('parseArticleBody', () => {
  it('paragraf dipisah baris kosong; baris lanjutan disambung', () => {
    expect(simple('Baris satu\nbaris dua\n\nParagraf dua')).toEqual([
      { style: 'normal', list: null, text: 'Baris satu baris dua' },
      { style: 'normal', list: null, text: 'Paragraf dua' },
    ]);
  });

  it('subjudul, daftar, kutipan', () => {
    expect(simple('# Judul\n## Sub\n### Kecil\n- a\n* b\n1. satu\n2) dua\n> kutip\n> lanjut\nsetelah')).toEqual([
      { style: 'h2', list: null, text: 'Judul' },
      { style: 'h2', list: null, text: 'Sub' },
      { style: 'h3', list: null, text: 'Kecil' },
      { style: 'normal', list: 'bullet', text: 'a' },
      { style: 'normal', list: 'bullet', text: 'b' },
      { style: 'normal', list: 'number', text: 'satu' },
      { style: 'normal', list: 'number', text: 'dua' },
      { style: 'blockquote', list: null, text: 'kutip lanjut setelah' },
    ]);
  });

  it('tebal dan miring; penanda tanpa pasangan tetap teks', () => {
    expect(simple('Ini **penting** dan *miring* dan _juga_; 2 * 3 = 6 dan **tanpa tutup')).toEqual([
      { style: 'normal', list: null, text: 'Ini [strong:penting] dan [em:miring] dan [em:juga]; 2 * 3 = 6 dan **tanpa tutup' },
    ]);
  });

  it('HTML, tautan, dan gambar tetap teks biasa', () => {
    const src = '<script>alert(1)</script> [klik](https://contoh.test) ![g](x.png) https://contoh.test';
    const [b] = parseArticleBody(src);
    expect(b?.children).toEqual([{ _key: 'b0s0', text: src, marks: [] }]);
  });

  it('kunci deterministik dan CRLF', () => {
    expect(parseArticleBody('a\r\n\r\nb').map((b) => b._key)).toEqual(['b0', 'b1']);
    expect(parseArticleBody('   \n\n')).toEqual([]);
  });

  it('teks polos dan menit baca', () => {
    expect(articlePlainText('## Judul\nIsi **tebal**')).toBe('Judul\nIsi tebal');
    expect(articleReadingMinutes('a')).toBe(1);
    expect(articleReadingMinutes('x'.repeat(3300))).toBe(3);
  });
});

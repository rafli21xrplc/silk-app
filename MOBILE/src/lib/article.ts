import type { PublicArticle } from '@silk/shared';

type Block = PublicArticle['body'][number];
export type ArticleNode = { kind: 'block'; block: Block } | { kind: 'list'; ordered: boolean; items: Block[] };

/** Kelompokkan blok berurutan yang merupakan butir daftar menjadi satu daftar (ul/ol). */
export function groupArticleBlocks(blocks: readonly Block[]): ArticleNode[] {
  const out: ArticleNode[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.listItem) {
      const ordered = b.listItem === 'number';
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(b);
      else out.push({ kind: 'list', ordered, items: [b] });
    } else out.push({ kind: 'block', block: b });
  }
  return out;
}

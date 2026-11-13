import type { PublicArticle } from '@silk/shared';
import { groupArticleBlocks } from '@/lib/article';

type Block = PublicArticle['body'][number];

function Spans({ block }: { block: Block }) {
  return (
    <>
      {block.children.map((c) => {
        let node: React.ReactNode = c.text;
        if (c.marks.includes('em')) node = <em>{node}</em>;
        if (c.marks.includes('strong')) node = <strong>{node}</strong>;
        return <span key={c._key}>{node}</span>;
      })}
    </>
  );
}

/** Isi artikel dari blok terstruktur (bukan HTML mentah): aman dari injeksi. */
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="grid gap-3 text-base leading-relaxed text-ink-soft">
      {groupArticleBlocks(blocks).map((n, i) => {
        if (n.kind === 'list') {
          const List = n.ordered ? 'ol' : 'ul';
          return (
            <List key={i} className={`m-0 grid gap-1 pl-5 ${n.ordered ? 'list-decimal' : 'list-disc'}`}>
              {n.items.map((b) => (
                <li key={b._key}>
                  <Spans block={b} />
                </li>
              ))}
            </List>
          );
        }
        const b = n.block;
        if (b.style === 'h2') return <h2 key={b._key} className="m-0 mt-2 text-lg font-bold text-ink"><Spans block={b} /></h2>;
        if (b.style === 'h3') return <h3 key={b._key} className="m-0 mt-1 text-base font-bold text-ink"><Spans block={b} /></h3>;
        if (b.style === 'blockquote') return <blockquote key={b._key} className="m-0 border-l-4 border-primary-200 pl-3 italic"><Spans block={b} /></blockquote>;
        return <p key={b._key} className="m-0"><Spans block={b} /></p>;
      })}
    </div>
  );
}

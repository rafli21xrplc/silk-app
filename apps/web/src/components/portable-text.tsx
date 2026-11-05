import { headingIds } from '@/lib/article-meta';
import { cn } from '@/lib/cn';
import type { PortableBlock } from '@/lib/sanity';

/** Render Portable Text minimal (paragraf, judul, daftar) tanpa HTML mentah. Subjudul h2 diberi id untuk daftar isi. */
export function PortableText({
  blocks,
  className,
}: {
  blocks: PortableBlock[];
  className?: string;
}) {
  const ids = headingIds(blocks);
  const out: React.ReactNode[] = [];
  let list: { type: 'bullet' | 'number'; items: PortableBlock[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((b, i) => <li key={b._key ?? i}>{textOf(b)}</li>);
    out.push(
      list.type === 'number' ? (
        <ol key={`l${out.length}`}>{items}</ol>
      ) : (
        <ul key={`l${out.length}`}>{items}</ul>
      ),
    );
    list = null;
  };
  blocks.forEach((b, i) => {
    if (b._type !== 'block') return;
    if (b.listItem) {
      if (list && list.type !== b.listItem) flush();
      list ??= { type: b.listItem, items: [] };
      list.items.push(b);
      return;
    }
    flush();
    const key = b._key ?? i;
    if (b.style === 'h2')
      out.push(
        <h2 key={key} id={ids.get(i)?.id}>
          {textOf(b)}
        </h2>,
      );
    else if (b.style === 'h3') out.push(<h3 key={key}>{textOf(b)}</h3>);
    else if (b.style === 'blockquote') out.push(<blockquote key={key}>{textOf(b)}</blockquote>);
    else out.push(<p key={key}>{textOf(b)}</p>);
  });
  flush();
  return <div className={cn('prose', className)}>{out}</div>;
}

function textOf(b: PortableBlock) {
  return (b.children ?? []).map((c, i) => {
    const marks = c.marks ?? [];
    let node: React.ReactNode = c.text ?? '';
    if (marks.includes('strong')) node = <strong>{node}</strong>;
    if (marks.includes('em')) node = <em>{node}</em>;
    return <span key={c._key ?? i}>{node}</span>;
  });
}

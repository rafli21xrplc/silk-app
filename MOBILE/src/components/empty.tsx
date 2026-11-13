import { SearchX } from 'lucide-react';

export function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-4 grid justify-items-center gap-3 rounded-card border border-dashed border-line-strong bg-white/60 px-6 py-10 text-center" data-empty>
      <span className="grid size-12 place-items-center rounded-full bg-surface text-muted">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <p className="m-0 max-w-xs text-sm text-ink-soft">{text}</p>
      {children}
    </div>
  );
}

import { SearchX } from 'lucide-react';

export function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 px-8 py-10 text-center" data-empty>
      <SearchX className="size-6 text-muted" aria-hidden="true" />
      <p className="m-0 max-w-xs text-sm text-ink-soft">{text}</p>
      {children}
    </div>
  );
}

import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

const TONE: Record<string, string> = {
  draft: 'bg-surface-2 text-ink-soft',
  pending: 'bg-warn-soft text-warn',
  published: 'bg-mint text-mint-ink',
  rejected: 'bg-danger-soft text-danger',
  withdrawn: 'bg-surface-2 text-muted',
};

export function ArticleStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', TONE[status] ?? TONE.draft, className)}>
      {t.articleEditor.status[status] ?? status}
    </span>
  );
}

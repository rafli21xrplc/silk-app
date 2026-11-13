import { CloudOff } from 'lucide-react';
import { formatShortDate } from '@/lib/format';
import { t } from '@/messages/id';

/** Pemberitahuan jujur saat data cadangan dipakai (API tidak terjangkau). */
export function DemoNotice({ show, date }: { show: boolean; date: string }) {
  if (!show) return null;
  return (
    <div role="status" className="mx-4 mt-3 flex items-start gap-2.5 rounded-2xl border border-warn-line bg-warn-soft px-3.5 py-2.5 text-sm text-warn" data-demo-notice>
      <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {t.demo.banner} {t.demo.bannerDate(formatShortDate(date))}
      </span>
    </div>
  );
}

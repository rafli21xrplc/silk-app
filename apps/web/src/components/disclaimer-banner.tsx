import { Info } from 'lucide-react';
import { t } from '@/messages/id';

export function DisclaimerBanner() {
  return (
    <p className="disclaimer my-5 flex items-start gap-3 rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-[0.9rem] text-ink-soft" role="note">
      <Info className="mt-0.5 size-[18px] shrink-0 text-warn" aria-hidden="true" />
      <span>{t.disclaimer}</span>
    </p>
  );
}

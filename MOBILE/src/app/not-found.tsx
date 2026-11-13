import Link from 'next/link';
import { Compass } from 'lucide-react';
import { t } from '@/messages/id';

export default function NotFound() {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div className="grid justify-items-center gap-3">
        <span className="grid size-14 place-items-center rounded-full bg-primary-50 text-primary-700">
          <Compass className="size-7" aria-hidden="true" />
        </span>
        <h1 className="m-0 text-xl font-bold">{t.common.notFoundTitle}</h1>
        <p className="m-0 max-w-xs text-sm text-muted">{t.common.notFoundBody}</p>
        <Link href="/" className="tap mt-2 inline-flex h-12 items-center rounded-full bg-primary-600 px-6 font-semibold text-white no-underline shadow-soft">
          {t.common.backHome}
        </Link>
      </div>
    </div>
  );
}

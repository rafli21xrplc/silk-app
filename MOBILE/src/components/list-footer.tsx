'use client';

import { Loader2 } from 'lucide-react';
import { t } from '@/messages/id';

/** Penutup daftar: pemuat, galat dengan tombol coba lagi, atau penanda akhir. */
export function ListFooter(props: {
  sentinel: React.RefObject<HTMLDivElement | null>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  onMore: () => void;
  count: number;
}) {
  return (
    <div className="px-4 py-5 text-center text-sm text-muted">
      <div ref={props.sentinel} aria-hidden="true" />
      {props.isFetchingNextPage ? (
        <span className="inline-flex items-center gap-2" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t.common.loading}
        </span>
      ) : props.isError ? (
        <span className="grid justify-items-center gap-2" role="alert">
          {t.common.error}
          <button type="button" onClick={props.onMore} className="tap rounded-full bg-white px-4 py-2 font-semibold text-primary-700">
            {t.common.retry}
          </button>
        </span>
      ) : props.hasNextPage ? (
        <button type="button" onClick={props.onMore} className="tap rounded-full bg-white px-4 py-2 font-semibold text-primary-700">
          {t.common.loadMore}
        </button>
      ) : props.count > 0 ? (
        t.common.end
      ) : null}
    </div>
  );
}

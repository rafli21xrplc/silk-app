'use client';

import { facilityPageSchema, type FacilityPage } from '@/lib/pages';
import { t } from '@/messages/id';
import { Empty } from './empty';
import { FacilityCard } from './facility-card';
import { ListFooter } from './list-footer';
import { useInfiniteList } from './use-infinite-list';

export function FacilityResults({ query, initial }: { query: string; initial: FacilityPage }) {
  const list = useInfiniteList({ key: 'faskes', endpoint: '/api/faskes', query, initial, schema: facilityPageSchema });
  if (list.items.length === 0) return <Empty text={t.search.none} />;
  return (
    <>
      <p className="m-0 px-4 pb-2 text-[0.8rem] font-semibold text-muted" aria-live="polite">
        {t.search.results(list.items.length, list.hasNextPage)}
      </p>
      <ul className="m-0 grid list-none gap-3 px-4">
        {list.items.map((f) => (
          <li key={f.id} className="animate-rise">
            <FacilityCard facility={f} />
          </li>
        ))}
      </ul>
      <ListFooter
        sentinel={list.sentinel}
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        isError={list.isFetchNextPageError}
        onMore={() => void list.fetchNextPage()}
        count={list.items.length}
      />
    </>
  );
}

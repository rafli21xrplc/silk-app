'use client';

import { facilityPageSchema, type FacilityPage } from '@/lib/pages';
import { t } from '@/messages/id';
import { Empty } from './empty';
import { commonVerification } from '@/lib/trust';
import { FacilityRow } from './facility-card';
import { ListBox } from './list';
import { ListFooter } from './list-footer';
import { useInfiniteList } from './use-infinite-list';

export function FacilityResults({ query, initial }: { query: string; initial: FacilityPage }) {
  const list = useInfiniteList({ key: 'faskes', endpoint: '/api/faskes', query, initial, schema: facilityPageSchema });
  if (list.items.length === 0) return <Empty text={t.search.none} />;
  const trusts = list.items.flatMap((f) => (f.price && f.trust ? [f.trust] : []));
  const common = commonVerification(trusts);
  return (
    <>
      <p className="m-0 px-5 pb-2 text-xs text-muted" aria-live="polite">
        <span className="font-medium">{t.search.results(list.items.length, list.hasNextPage)}</span>
        {trusts.length > 0 && ` · ${t.price.groupNote(common ? (t.verification[common] ?? null) : null)}`}
      </p>
      <ListBox>
        {list.items.map((f) => (
          <FacilityRow key={f.id} facility={f} common={common} />
        ))}
      </ListBox>
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

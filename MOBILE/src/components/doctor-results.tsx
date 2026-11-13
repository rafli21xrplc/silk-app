'use client';

import { doctorPageSchema, type DoctorPage } from '@/lib/pages';
import { t } from '@/messages/id';
import { DoctorRow } from './doctor-card';
import { Empty } from './empty';
import { ListBox } from './list';
import { ListFooter } from './list-footer';
import { useInfiniteList } from './use-infinite-list';

export function DoctorResults({ query, initial }: { query: string; initial: DoctorPage }) {
  const list = useInfiniteList({ key: 'dokter', endpoint: '/api/dokter', query, initial, schema: doctorPageSchema });
  if (list.items.length === 0) return <Empty text={t.doctors.none} />;
  return (
    <>
      <p className="m-0 px-5 pb-2 text-xs font-medium text-muted" aria-live="polite">
        {t.doctors.results(list.items.length, list.hasNextPage)}
      </p>
      <ListBox>
        {list.items.map((d) => (
          <DoctorRow key={d.slug} doctor={d} />
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

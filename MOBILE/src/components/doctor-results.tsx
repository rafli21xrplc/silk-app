'use client';

import { doctorPageSchema, type DoctorPage } from '@/lib/pages';
import { t } from '@/messages/id';
import { DoctorCard } from './doctor-card';
import { Empty } from './empty';
import { ListFooter } from './list-footer';
import { useInfiniteList } from './use-infinite-list';

export function DoctorResults({ query, initial }: { query: string; initial: DoctorPage }) {
  const list = useInfiniteList({ key: 'dokter', endpoint: '/api/dokter', query, initial, schema: doctorPageSchema });
  if (list.items.length === 0) return <Empty text={t.doctors.none} />;
  return (
    <>
      <p className="m-0 px-4 pb-2 text-[0.8rem] font-semibold text-muted" aria-live="polite">
        {t.doctors.results(list.items.length, list.hasNextPage)}
      </p>
      <ul className="m-0 grid list-none gap-3 px-4">
        {list.items.map((d) => (
          <li key={d.slug} className="animate-rise">
            <DoctorCard doctor={d} />
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

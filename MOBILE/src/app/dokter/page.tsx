import type { Metadata } from 'next';
import { ChipLink } from '@/components/chip-link';
import { DemoNotice } from '@/components/demo-notice';
import { DoctorResults } from '@/components/doctor-results';
import { SearchForm } from '@/components/search-form';
import { parseDoctorParams, toQueryString, type DoctorParams } from '@/lib/search';
import { anyDemo, getSpecialties, searchPractitioners, snapshotDate } from '@/lib/silk/api';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.doctors.title };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const href = (p: DoctorParams) => {
  const qs = toQueryString({ q: p.q, specialty: p.specialty, sort: p.sort, video: p.video, fee: p.fee });
  return qs ? `/dokter?${qs}` : '/dokter';
};

export default async function DoctorsPage({ searchParams }: { searchParams: SearchParams }) {
  const p = parseDoctorParams(await searchParams);
  const [first, specialties] = await Promise.all([searchPractitioners({ ...p, cursor: undefined }), getSpecialties()]);
  const query = toQueryString({ q: p.q, specialty: p.specialty, sort: p.sort, video: p.video, fee: p.fee });

  return (
    <>
      <header className="pt-safe px-4 pb-3">
        <h1 className="m-0 pt-4 text-xl font-extrabold tracking-tight">{t.doctors.title}</h1>
        <p className="m-0 mt-1 mb-3 text-[0.82rem] text-muted">{t.doctors.intro}</p>
        <SearchForm action="/dokter" placeholder={t.doctors.placeholder} defaultValue={p.q} hidden={{ specialty: p.specialty }} />
      </header>
      <div className="sticky top-0 z-20 grid gap-2 border-b border-line/60 bg-canvas/95 py-2.5 backdrop-blur">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4" role="group" aria-label={t.search.filters}>
          <ChipLink href={href({ ...p, fee: p.fee ? undefined : '1' })} active={!!p.fee}>
            {t.doctors.filterFee}
          </ChipLink>
          <ChipLink href={href({ ...p, video: p.video ? undefined : '1' })} active={!!p.video}>
            {t.doctors.filterVideo}
          </ChipLink>
          <ChipLink href={href({ ...p, sort: p.sort === 'fee_asc' ? undefined : 'fee_asc' })} active={p.sort === 'fee_asc'}>
            {t.doctors.sortFeeChip}
          </ChipLink>
        </div>
        {specialties.data.length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4" role="group" aria-label={t.doctors.specialty}>
            <ChipLink href={href({ ...p, specialty: undefined })} active={!p.specialty}>
              {t.doctors.allSpecialties}
            </ChipLink>
            {specialties.data.map((s) => (
              <ChipLink key={s.name} href={href({ ...p, specialty: s.name })} active={p.specialty === s.name}>
                {`${s.name} (${s.count})`}
              </ChipLink>
            ))}
          </div>
        )}
      </div>
      <DemoNotice show={anyDemo(first, specialties)} date={snapshotDate()} />
      <div className="pt-3">
        <DoctorResults key={query} query={query} initial={first} />
      </div>
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Layers, MapPin, Microscope, Stethoscope } from 'lucide-react';
import { ServiceCatalog } from '@/components/service/service-catalog';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { loadCatalog } from '@/lib/services';
import { t } from '@/messages/id';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: t.services.title,
  description: t.services.intro,
  alternates: { canonical: '/layanan' },
};

export default async function ServicesPage() {
  const services = await loadCatalog();
  const categoryCount = new Set(services.map((s) => s.category.slug)).size;
  const cityCount = new Set(services.flatMap((s) => s.summary?.cities ?? [])).size;
  const stats = [
    { icon: Stethoscope, label: t.services.statServices(services.length) },
    { icon: Layers, label: t.services.statCategories(categoryCount) },
    ...(cityCount > 0 ? [{ icon: MapPin, label: t.services.statCities(cityCount) }] : []),
  ];

  return (
    <div className="container">
      {/* Kepala halaman: panel pastel, senada dengan beranda dan artikel. */}
      <header className="relative isolate mb-8 overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br from-primary-100 via-[#eef7f8] to-sky px-6 py-10 shadow-soft sm:px-10 sm:py-14">
        <span aria-hidden="true" className="absolute -top-16 -right-10 -z-10 size-64 rounded-full bg-white/50 blur-2xl" />
        <span aria-hidden="true" className="absolute -bottom-24 left-1/4 -z-10 size-72 rounded-full bg-mint/80 blur-3xl" />
        <Microscope
          aria-hidden="true"
          className="absolute top-1/2 right-10 -z-10 hidden size-44 -translate-y-1/2 rotate-6 text-primary-700/10 md:block"
          strokeWidth={1.25}
        />
        <p className="mb-4 inline-flex animate-rise items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-primary-800 shadow-soft backdrop-blur">
          <Microscope className="size-4" aria-hidden="true" />
          {t.services.eyebrow}
        </p>
        <h1 className="max-w-2xl text-[clamp(1.9rem,1.3rem+2.6vw,3rem)] leading-[1.1] font-extrabold tracking-[-0.03em]">
          {t.services.heading}
        </h1>
        <p className="m-0 max-w-xl animate-rise text-lg text-ink-soft [animation-delay:80ms]">{t.services.intro}</p>
        {services.length > 0 && (
          <ul className="m-0 mt-6 flex animate-rise list-none flex-wrap gap-2 p-0 [animation-delay:160ms]">
            {stats.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-ink-soft shadow-soft backdrop-blur"
              >
                <Icon className="size-4 text-primary-700" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        )}
      </header>

      {services.length === 0 ? (
        <EmptyState icon={Stethoscope} title={t.services.emptyTitle}>
          {t.services.empty}
        </EmptyState>
      ) : (
        <ServiceCatalog services={services} />
      )}

      <section className="mt-14 flex flex-col items-start justify-between gap-5 rounded-card bg-primary-800 px-6 py-8 text-white shadow-lift sm:flex-row sm:items-center sm:px-10">
        <div>
          <h2 className="m-0 mb-1 text-xl text-white">{t.services.ctaTitle}</h2>
          <p className="m-0 max-w-xl text-primary-100">{t.services.ctaBody}</p>
        </div>
        <Link href="/cari" className={buttonVariants({ variant: 'secondary', className: 'shrink-0 border-white' })}>
          {t.services.ctaButton}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

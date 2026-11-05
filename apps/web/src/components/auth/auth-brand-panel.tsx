import { Check } from 'lucide-react';
import { t } from '@/messages/id';

/** Garis nadi SILK, versi besar untuk latar panel. */
function PulseLine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 80" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M0 40h120l20-28 32 56 24-42 14 14h190" />
    </svg>
  );
}

/** Panel merek di sisi kiri halaman akun (desktop) dan pita ringkas di atas form (ponsel). */
export function AuthBrandPanel() {
  const p = t.authPanel;
  return (
    <>
      {/* Ponsel/tablet: pita ringkas agar form tetap di atas lipatan. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-primary-800 px-5 py-5 text-white sm:px-10 lg:hidden">
        <PulseLine className="pointer-events-none absolute -right-10 bottom-0 w-64 text-white/15" />
        <p className="m-0 text-xs font-semibold tracking-[0.12em] text-primary-100 uppercase">{p.badge}</p>
        <p className="m-0 mt-1 max-w-[30ch] font-bold text-white">{p.title}</p>
      </div>

      {/* Desktop: panel penuh. */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-10 text-white lg:flex lg:flex-col xl:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-16 size-80 animate-float rounded-full bg-primary-400/30 blur-3xl" />
          <div className="absolute -right-20 bottom-10 size-72 animate-float rounded-full bg-sand-200/15 blur-3xl [animation-delay:-3s]" />
          <PulseLine className="absolute right-0 bottom-24 w-[115%] text-white/10" />
        </div>

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold text-white">
            <span className="size-2 rounded-full bg-primary-200" aria-hidden="true" />
            {p.badge}
          </span>
          <p className="mt-8 mb-0 max-w-[18ch] text-[2rem] leading-[1.15] font-extrabold tracking-tight text-balance text-white">{p.title}</p>
          <p className="mt-4 mb-0 max-w-[36ch] text-primary-100">{p.intro}</p>
        </div>

        <ul className="relative m-0 mt-10 grid list-none gap-4 p-0">
          {p.points.map((point) => (
            <li key={point} className="m-0 flex items-start gap-3 text-white">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/25" aria-hidden="true">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>

        <p className="relative mt-auto mb-0 border-t border-white/15 pt-6 text-sm text-primary-100">{p.note}</p>
      </div>
    </>
  );
}

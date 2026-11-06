import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { t } from '@/messages/id';
import { Logo } from './logo';

const linkCls = 'text-ink-soft no-underline hover:text-primary-800 hover:underline';

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-line bg-surface">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.2fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-[0.925rem] text-muted">{t.footer.blurb}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-sm font-medium text-primary-800 shadow-soft">
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t.footer.note}
          </p>
        </div>
        <nav aria-label={t.footer.label} className="grid grid-cols-2 gap-8">
          <div>
            <h2 className="mt-0 mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{t.footer.explore}</h2>
            <ul className="m-0 grid list-none gap-2 p-0 text-[0.95rem]">
              <li><Link className={linkCls} href="/cari">{t.nav.search}</Link></li>
              <li><Link className={linkCls} href="/dokter">{t.nav.doctors}</Link></li>
              <li><Link className={linkCls} href="/layanan">{t.nav.services}</Link></li>
              <li><Link className={linkCls} href="/artikel">{t.nav.articles}</Link></li>
              <li><Link className={linkCls} href="/masuk">{t.nav.login}</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="mt-0 mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{t.footer.trust}</h2>
            <ul className="m-0 grid list-none gap-2 p-0 text-[0.95rem]">
              <li><Link className={linkCls} href="/metodologi">{t.footer.methodology}</Link></li>
              <li><Link className={linkCls} href="/tentang">{t.footer.about}</Link></li>
              <li><Link className={linkCls} href="/privasi">{t.footer.privacy}</Link></li>
              <li><Link className={linkCls} href="/syarat">{t.footer.terms}</Link></li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="container py-5">
          <p className="m-0 text-sm text-muted">© {new Date().getFullYear()} SILK</p>
        </div>
      </div>
    </footer>
  );
}

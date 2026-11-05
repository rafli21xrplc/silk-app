import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel';
import { Logo } from '@/components/logo';
import { t } from '@/messages/id';

/**
 * Kerangka halaman akun (masuk, daftar, sandi): layar penuh tanpa navbar/footer situs
 * (lihat SiteChrome), hanya logo + tautan ke beranda. URL tidak berubah (route group).
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-akun className="flex min-h-dvh flex-col bg-aurora px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-[1040px] items-center justify-between gap-4">
        <Logo />
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft no-underline hover:text-primary-800">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t.auth.backToHome}
        </Link>
      </div>
      <div className="flex flex-1 items-center py-6 sm:py-10">
        <div className="mx-auto grid w-full max-w-[1040px] overflow-hidden rounded-[2rem] border border-line bg-white shadow-lift lg:min-h-[620px] lg:grid-cols-[1fr_1.05fr]">
          <AuthBrandPanel />
          <section className="flex items-center px-5 py-8 sm:px-10 sm:py-12 lg:px-14">
            <div className="mx-auto w-full max-w-[400px] animate-rise">{children}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ConsentBanner } from '@/components/consent-banner';
import { PartnerBar } from '@/components/partner-bar';
import { SiteChrome } from '@/components/site-chrome';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { SITE_URL } from '@/lib/config';
import { siteNoIndex } from '@/lib/seo';
import { t } from '@/messages/id';
import './globals.css';

/** Plus Jakarta Sans (Tokotype, Indonesia). Di-host sendiri oleh next/font: tanpa permintaan ke Google saat runtime. */
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-jakarta' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${t.site.name}: ${t.site.tagline}`, template: `%s | ${t.site.name}` },
  description: t.site.description,
  openGraph: { siteName: t.site.name, locale: 'id_ID', type: 'website' },
  robots: siteNoIndex() ? { index: false, follow: false } : { index: true, follow: true },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#fafaf7' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="flex min-h-dvh flex-col">
        <a href="#konten" className="skip-link">
          {t.nav.skip}
        </a>
        <SiteChrome>
          <PartnerBar />
          <SiteHeader />
        </SiteChrome>
        {/* Halaman akun ([data-akun]) mengatur jaraknya sendiri. */}
        <main id="konten" className="flex-1 has-[>[data-akun]]:py-0">
          {children}
        </main>
        <SiteChrome>
          <SiteFooter />
        </SiteChrome>
        <ConsentBanner />
      </body>
    </html>
  );
}

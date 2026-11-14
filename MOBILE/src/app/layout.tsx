import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { NavTracker } from '@/components/back-button';
import { BottomNav } from '@/components/bottom-nav';
import { indexingAllowed } from '@/lib/indexing';
import { Providers } from '@/components/providers';
import { t } from '@/messages/id';
import './globals.css';

/** Plus Jakarta Sans, di-host sendiri oleh next/font (tanpa permintaan ke Google saat runtime). */
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: { default: `${t.site.name}: ${t.site.tagline}`, template: `%s · ${t.site.name}` },
  description: t.site.description,
  applicationName: t.site.name,
  appleWebApp: { capable: true, title: t.site.name, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: { icon: '/icons/192', apple: '/icons/180' },
  robots: indexingAllowed() ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6faf9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body>
        <a href="#konten" className="skip-link">
          {t.nav.skip}
        </a>
        <Providers>
          {/* Satu kolom selebar ponsel; di laptop tampil sebagai bingkai ponsel di tengah layar (untuk demo). */}
          <div className="relative mx-auto min-h-dvh w-full max-w-[440px] bg-canvas sm:border-x sm:border-line/70 sm:shadow-lift">
            <main id="konten" className="pb-28">
              {children}
            </main>
          </div>
          <BottomNav />
          <NavTracker />
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { PortalFlagsProvider } from '@/components/portal/portal-flags';
import { featureEnabled } from '@/lib/flags';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.portal.title, robots: { index: false, follow: false } };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // Flag dibaca di server; komponen klien portal hanya memakainya untuk menu.
  return <PortalFlagsProvider value={{ subscriptions: featureEnabled('subscriptions_enabled') }}>{children}</PortalFlagsProvider>;
}

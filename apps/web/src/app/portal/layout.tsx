import type { Metadata } from 'next';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.portal.title, robots: { index: false, follow: false } };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}

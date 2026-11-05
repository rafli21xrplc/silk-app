import type { Metadata } from 'next';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.account.title, robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.admin.title, robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}

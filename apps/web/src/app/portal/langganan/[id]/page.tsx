import { notFound } from 'next/navigation';
import { featureEnabled } from '@/lib/flags';
import { t } from '@/messages/id';
import { PaymentReturnPage } from '../subscription-page';

/** Halaman kembali dari Duitku. Status dibaca dari API, bukan dari parameter URL. */
export default function Page() {
  if (!featureEnabled('subscriptions_enabled')) notFound();
  return <PaymentReturnPage title={t.subscription.returnTitle} />;
}

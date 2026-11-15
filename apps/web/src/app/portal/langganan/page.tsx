import { notFound } from 'next/navigation';
import { featureEnabled } from '@/lib/flags';
import { t } from '@/messages/id';
import { SubscriptionPage } from './subscription-page';

/** Fase 11: langganan mitra. Flag OFF = 404 (API juga 404). */
export default function Page() {
  if (!featureEnabled('subscriptions_enabled')) notFound();
  return <SubscriptionPage title={t.subscription.title} />;
}

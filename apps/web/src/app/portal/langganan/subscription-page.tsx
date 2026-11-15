'use client';

import { useParams } from 'next/navigation';
import { PaymentReturn, SubscriptionView } from '@/components/portal/subscription-view';
import { PortalShell } from '../portal-shell';

export function SubscriptionPage({ title }: { title: string }) {
  return (
    <PortalShell require="partner" title={title}>
      {(me) => <SubscriptionView me={me} />}
    </PortalShell>
  );
}

export function PaymentReturnPage({ title }: { title: string }) {
  const { id } = useParams<{ id: string }>();
  return (
    <PortalShell require="partner" title={title}>
      {() => <PaymentReturn id={id} />}
    </PortalShell>
  );
}

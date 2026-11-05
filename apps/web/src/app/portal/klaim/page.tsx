import { Suspense } from 'react';
import { ClaimsView } from './claims-view';

export default function PortalClaimsPage() {
  return (
    <Suspense>
      <ClaimsView />
    </Suspense>
  );
}

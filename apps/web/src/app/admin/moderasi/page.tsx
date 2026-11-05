import { Suspense } from 'react';
import { ModerationView } from './moderation-view';

export default function AdminModerationPage() {
  return (
    <Suspense>
      <ModerationView />
    </Suspense>
  );
}

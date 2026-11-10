import { Suspense } from 'react';
import { featureEnabled } from '@/lib/flags';
import { ModerationView } from './moderation-view';

export default function AdminModerationPage() {
  return (
    <Suspense>
      {/* Tab ulasan hanya ada bila flag reviews_enabled menyala (API juga 404 saat OFF). */}
      <ModerationView reviewsEnabled={featureEnabled('reviews_enabled')} />
    </Suspense>
  );
}

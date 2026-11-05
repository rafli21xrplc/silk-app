'use client';

import { useEffect } from 'react';
import type { AnalyticsEvent } from '@silk/shared';
import { track } from '@/lib/analytics';

/** Kirim satu peristiwa saat halaman dibuka. */
export function TrackView({ event, props }: { event: AnalyticsEvent; props: Record<string, string | number | null | undefined> }) {
  const key = JSON.stringify(props);
  useEffect(() => {
    track(event, props);
  }, [event, key]);
  return null;
}

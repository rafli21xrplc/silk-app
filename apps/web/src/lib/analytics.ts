'use client';

import type { AnalyticsEvent } from '@silk/shared';

const CONSENT_KEY = 'silk-analytics-consent';
type PostHog = typeof import('posthog-js').default;
let ph: PostHog | null = null;

export function getConsent(): 'ya' | 'tidak' | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'ya' || v === 'tidak' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: 'ya' | 'tidak'): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // penyimpanan diblokir: anggap tidak setuju
  }
  if (value === 'ya') void initAnalytics();
}

/** PostHog hanya dimuat setelah persetujuan (M18). Tanpa data pribadi; autocapture mati. */
export async function initAnalytics(): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || ph || getConsent() !== 'ya') return;
  const mod = await import('posthog-js');
  ph = mod.default;
  ph.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    autocapture: false,
    capture_pageview: true,
    disable_session_recording: true,
    persistence: 'localStorage+cookie',
    person_profiles: 'never',
  });
}

/** Kirim peristiwa produk dengan properti city, service, facility_id (bila ada). */
export function track(event: AnalyticsEvent, props: { city?: string | null; service?: string | null; facility_id?: string | null; [k: string]: unknown } = {}): void {
  if (!ph) return;
  ph.capture(event, props);
}

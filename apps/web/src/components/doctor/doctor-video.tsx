'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { doctorInitials } from '@/lib/doctor';
import { formatDuration } from '@/lib/format';
import { t } from '@/messages/id';

type Video = { url: string; mime: string; durationSec: number | null; caption: string | null };

/**
 * Video perkenalan dokter (USP P2) dengan pola "ketuk untuk memutar": sebelum diketuk hanya poster
 * (foto dokter, atau inisial) yang tampil, jadi video tidak diunduh dan tidak memperlambat halaman (LCP).
 */
export function DoctorVideo({ video, name, posterUrl }: { video: Video; name: string; posterUrl: string | null }) {
  const [playing, setPlaying] = useState(false);
  const duration = video.durationSec ? formatDuration(video.durationSec) : null;
  const label = video.caption ?? `${t.doctors.video} ${name}`;

  return (
    <figure className="m-0">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink">
        {playing ? (
          <video controls autoPlay playsInline preload="auto" className="size-full" aria-label={label}>
            <source src={video.url} type={video.mime} />
          </video>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 grid size-full cursor-pointer place-items-center outline-none focus-visible:shadow-[var(--shadow-focus)]"
            aria-label={t.doctors.playVideo(name, duration)}
          >
            {posterUrl ? (
              <img src={posterUrl} alt="" className="absolute inset-0 size-full object-cover opacity-80" />
            ) : (
              <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary-700 to-primary-900 text-6xl font-semibold text-white/30" aria-hidden="true">
                {doctorInitials(name)}
              </span>
            )}
            <span className="relative grid size-16 place-items-center rounded-full bg-white/95 text-primary-800 shadow-lift transition-transform duration-300 group-hover:scale-105">
              <Play className="ml-1 size-7" fill="currentColor" aria-hidden="true" />
            </span>
            {duration && (
              <span className="absolute right-3 bottom-3 rounded-full bg-ink/80 px-2.5 py-0.5 text-sm font-semibold text-white tabular-nums" aria-hidden="true">
                {duration}
              </span>
            )}
          </button>
        )}
      </div>
      <figcaption className="mt-1.5 text-sm text-muted">{video.caption ?? t.doctors.videoNote}</figcaption>
    </figure>
  );
}

'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { formatDuration } from '@/lib/format';
import { t } from '@/messages/id';
import { Avatar } from './avatar';

type Video = { url: string; mime: string; durationSec: number | null; caption: string | null };

/** Video perkenalan "ketuk untuk memutar": sebelum diketuk hanya poster, jadi video tidak diunduh. */
export function DoctorVideo({ video, name, posterUrl }: { video: Video; name: string; posterUrl: string | null }) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className="m-0">
      <div className="relative aspect-video w-full overflow-hidden rounded-card bg-ink">
        {playing ? (
          <video controls autoPlay playsInline preload="auto" className="size-full" aria-label={video.caption ?? t.doctors.playVideo(name)}>
            <source src={video.url} type={video.mime} />
          </video>
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={t.doctors.playVideo(name)} className="group grid size-full place-items-center bg-gradient-to-br from-primary-700 to-primary-900">
            <span className="absolute inset-0 grid place-items-center opacity-30">
              <Avatar name={name} photoUrl={posterUrl} size="lg" className="size-32 text-4xl" />
            </span>
            <span className="relative grid size-16 place-items-center rounded-full bg-white/95 text-primary-700 shadow-lift transition-transform group-active:scale-95">
              <Play className="ml-1 size-7 fill-current" aria-hidden="true" />
            </span>
            {video.durationSec && (
              <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">{formatDuration(video.durationSec)}</span>
            )}
          </button>
        )}
      </div>
      <figcaption className="mt-1.5 text-[0.75rem] text-muted">{video.caption ?? t.doctors.videoNote}</figcaption>
    </figure>
  );
}

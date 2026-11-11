import type { ReadinessCheck, ReadinessPillar } from '@silk/shared';
import { t } from '../messages/id';

const r = t.readiness;

/** Petunjuk singkat untuk butir yang belum selesai; null bila sudah selesai. */
export function readinessHint(c: ReadinessCheck): string | null {
  if (c.done) return null;
  switch (c.item) {
    case 'biaya_konsultasi':
      return c.state === 'tanya' ? r.hints.consultationAsk : r.hints.consultationNone;
    case 'tarif':
      return r.hints.tariffs(Number(c.state) || 0);
    case 'foto':
    case 'video':
      if (c.state === 'tanpa_persetujuan') return r.hints.videoNoConsent;
      if (c.state === 'menunggu') return r.hints.mediaPending;
      return c.item === 'video' ? `${r.hints.mediaNone} ${r.hints.videoWhy}` : r.hints.mediaNone;
    case 'dokter_terdaftar':
      return r.hints.practitioners;
    default:
      return r.hints.missing;
  }
}

/** Tautan ke tempat butir diisi; null bila tidak ada yang bisa dilakukan sendiri (mis. menunggu moderasi). */
export function readinessAction(c: ReadinessCheck, facilityId: string): { href: string; label: string } | null {
  if (c.done || c.state === 'menunggu') return null;
  switch (c.item) {
    case 'biaya_konsultasi':
    case 'tarif':
      return { href: `/portal/faskes/${facilityId}`, label: r.actions.tariffs };
    case 'foto':
    case 'video':
      return { href: '#media-title', label: r.actions.media };
    case 'dokter_terdaftar':
      return null;
    default:
      return { href: '#profil-dasar', label: r.actions.profile };
  }
}

/** Nama pilar; untuk profil selain praktik dokter, pilar kedua tentang tempatnya. */
export function pillarLabel(pillar: ReadinessPillar, facilityType: string): string {
  if (pillar === 'kenal' && facilityType !== 'praktik_dokter') return r.pillarPlace;
  return r.pillars[pillar] ?? pillar;
}

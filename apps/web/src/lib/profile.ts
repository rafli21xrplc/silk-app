import {
  CONSENT_DOC_ALLOWED_MIME,
  CONSENT_DOC_MAX_BYTES,
  PHOTO_ALLOWED_MIME,
  PHOTO_MAX_BYTES,
  VIDEO_ALLOWED_MIME,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SECONDS,
  VIDEO_MIN_SECONDS,
  type ConsentMethod,
  type ConsentScope,
  type MediaKind,
  type VideoConsentInput,
  type ScheduleKind,
} from '@silk/shared';
import type { Me } from './types';

/** Hari ISO: Senin = 1 … Minggu = 7 (sama dengan kolom `schedules.weekday`). */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const WEEKDAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday - 1] ?? String(weekday);
}

const TZ_SHORT: Record<string, string> = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };
export const tzShort = (tz: string) => TZ_SHORT[tz] ?? tz;

/** "07:00" + "20:00" → "07.00–20.00" (penulisan jam bahasa Indonesia). */
export function formatTimeRange(start: string, end: string): string {
  return `${start.replace(':', '.')}–${end.replace(':', '.')}`;
}

export interface ScheduleLike {
  kind: ScheduleKind;
  weekday: number;
  start: string;
  end: string;
  timezone: string;
}

/** Kelompokkan jadwal per hari Senin–Minggu, jam diurutkan; hari tanpa jadwal tetap ada (kosong). */
export function groupByWeekday<S extends ScheduleLike>(items: S[]): { weekday: number; items: S[] }[] {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    items: items.filter((s) => s.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start)),
  }));
}

/**
 * Pemeriksaan berkas di browser sebelum minta signed URL. Server tetap memeriksa ulang ukuran, magic bytes,
 * dan durasi MP4; ini hanya agar pengguna cepat tahu.
 */
export function mediaFileProblem(kind: MediaKind, file: { type: string; size: number }, durationSec?: number | null): 'type' | 'size' | 'duration' | null {
  const allowed: readonly string[] = kind === 'foto' ? PHOTO_ALLOWED_MIME : VIDEO_ALLOWED_MIME;
  if (!allowed.includes(file.type)) return 'type';
  if (file.size > (kind === 'foto' ? PHOTO_MAX_BYTES : VIDEO_MAX_BYTES)) return 'size';
  if (
    kind === 'video' &&
    (durationSec === null || durationSec === undefined || !Number.isFinite(durationSec) || durationSec > VIDEO_MAX_SECONDS || durationSec < VIDEO_MIN_SECONDS)
  ) {
    return 'duration';
  }
  return null;
}

/** Isian persetujuan video di portal (evaluasi USP R6). */
export interface ConsentDraft {
  method: ConsentMethod;
  subjectName: string;
  socialMedia: boolean;
  declaration: boolean;
  document: { name: string; type: string; size: number } | null;
}

export type ConsentProblem = 'subject' | 'declaration' | 'document' | 'documentType' | 'documentSize' | 'method';

/**
 * Bentuk `consent` untuk presign video, atau masalah pertama yang harus diperbaiki. Server memeriksa ulang
 * semuanya; pernyataan di akun hanya sah untuk akun tenaga medis (`selfAllowed`).
 */
export function consentFromDraft(d: ConsentDraft, selfAllowed: boolean): { consent: VideoConsentInput } | { problem: ConsentProblem } {
  if (d.method === 'pernyataan_akun' && !selfAllowed) return { problem: 'method' };
  const subjectName = d.subjectName.trim();
  if (subjectName.length < 3) return { problem: 'subject' };
  if (!d.declaration) return { problem: 'declaration' };
  const scopes: ConsentScope[] = d.socialMedia ? ['profil_web', 'media_sosial'] : ['profil_web'];
  if (d.method === 'pernyataan_akun') return { consent: { method: 'pernyataan_akun', subjectName, scopes, declaration: true } };
  if (!d.document) return { problem: 'document' };
  if (!(CONSENT_DOC_ALLOWED_MIME as readonly string[]).includes(d.document.type)) return { problem: 'documentType' };
  if (d.document.size > CONSENT_DOC_MAX_BYTES) return { problem: 'documentSize' };
  return {
    consent: {
      method: 'dokumen',
      subjectName,
      scopes,
      declaration: true,
      document: { fileName: d.document.name, mime: d.document.type as (typeof CONSENT_DOC_ALLOWED_MIME)[number], sizeBytes: d.document.size },
    },
  };
}

/** Mitra terverifikasi boleh membuat profil; non-faskes hanya satu profil (K2). */
export function canCreateProfile(me: Pick<Me, 'partner' | 'memberships' | 'user'>): boolean {
  if (me.partner?.status !== 'verified') return false;
  return me.user.role === 'faskes' || me.memberships.length === 0;
}

/** Angka koordinat dari input teks (koma desimal diterima). */
export function parseCoord(v: string): number | null {
  const n = Number(v.trim().replace(',', '.'));
  return v.trim() === '' || !Number.isFinite(n) ? null : n;
}

/**
 * Isian profil sebagai baris teks untuk perbandingan moderator (saat ini vs usulan revisi).
 * Lokasi dan jadwal diringkas per baris; id dan urutan internal diabaikan.
 */
export function describeProfileField(key: string, value: unknown, practitionerName: (id: string) => string | undefined = () => undefined): string[] {
  if (value === null || value === undefined || value === '') return [];
  if (key === 'locations' && Array.isArray(value)) {
    return (value as { label?: string | null; address: string; city: string; province: string; lat: number; lng: number; isPrimary: boolean }[]).map(
      (l) => `${l.isPrimary ? '★ ' : ''}${l.label ? `${l.label} — ` : ''}${l.address}, ${l.city}, ${l.province} (${l.lat}, ${l.lng})`,
    );
  }
  if (key === 'schedules' && Array.isArray(value)) {
    return groupByWeekday(value as (ScheduleLike & { practitionerId?: string | null; note?: string | null })[]).flatMap((d) =>
      d.items.map((s) => {
        const who = s.practitionerId ? practitionerName(s.practitionerId) : undefined;
        const extra = [s.kind === 'praktik' ? `praktik${who ? ` ${who}` : ''}` : null, s.note || null].filter(Boolean).join('; ');
        return `${weekdayName(d.weekday)} ${formatTimeRange(s.start, s.end)} ${tzShort(s.timezone)}${extra ? ` (${extra})` : ''}`;
      }),
    );
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`);
  }
  return [String(value)];
}

/**
 * Respons detail faskes dari data cache lama (sebelum Fase 2) tidak punya `locations`, `schedules`,
 * dan `media`. Isi dengan daftar kosong agar halaman publik tetap tampil.
 */
export function withProfileDefaults<T extends { locations?: unknown[]; schedules?: unknown[]; media?: unknown[] }>(
  f: T,
): T & { locations: NonNullable<T['locations']>; schedules: NonNullable<T['schedules']>; media: NonNullable<T['media']> } {
  return { ...f, locations: f.locations ?? [], schedules: f.schedules ?? [], media: f.media ?? [] };
}

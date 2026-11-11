import { describe, expect, it } from 'vitest';
import type { ReadinessCheck } from '@silk/shared';
import { t } from '../messages/id';
import { pillarLabel, readinessAction, readinessHint } from './readiness';

const check = (over: Partial<ReadinessCheck>): ReadinessCheck => ({ item: 'video', pillar: 'kenal', done: false, state: 'tidak_ada', optional: false, ...over });

describe('petunjuk kesiapan profil (portal)', () => {
  it('butir selesai tidak punya petunjuk atau tautan', () => {
    const c = check({ done: true, state: 'publik' });
    expect(readinessHint(c)).toBeNull();
    expect(readinessAction(c, 'f1')).toBeNull();
  });

  it('biaya konsultasi: "tanya" dan belum ada dibedakan; tautan ke halaman Tarif', () => {
    expect(readinessHint(check({ item: 'biaya_konsultasi', pillar: 'biaya', state: 'tanya' }))).toBe(t.readiness.hints.consultationAsk);
    expect(readinessHint(check({ item: 'biaya_konsultasi', pillar: 'biaya', state: 'tidak_ada' }))).toBe(t.readiness.hints.consultationNone);
    expect(readinessAction(check({ item: 'tarif', pillar: 'biaya', state: '1' }), 'f1')).toEqual({ href: '/portal/faskes/f1', label: t.readiness.actions.tariffs });
    expect(readinessHint(check({ item: 'tarif', pillar: 'biaya', state: '2' }))).toBe(t.readiness.hints.tariffs(2));
  });

  it('video: menunggu moderasi tanpa tautan; tanpa persetujuan diberi tahu alasannya', () => {
    expect(readinessAction(check({ state: 'menunggu' }), 'f1')).toBeNull();
    expect(readinessHint(check({ state: 'menunggu' }))).toBe(t.readiness.hints.mediaPending);
    expect(readinessHint(check({ state: 'tanpa_persetujuan' }))).toBe(t.readiness.hints.videoNoConsent);
    expect(readinessAction(check({ state: 'tanpa_persetujuan' }), 'f1')?.href).toBe('#media-title');
    expect(readinessHint(check({ state: 'tidak_ada' }))).toContain(t.readiness.hints.videoWhy);
  });

  it('butir kunjungan menaut ke formulir data profil', () => {
    expect(readinessAction(check({ item: 'jadwal', pillar: 'kunjungan' }), 'f1')?.href).toBe('#profil-dasar');
    expect(readinessAction(check({ item: 'dokter_terdaftar', state: '0', optional: true }), 'f1')).toBeNull();
  });

  it('pilar kedua: "Kenal dokternya" untuk praktik dokter, "Kenal tempatnya" untuk lainnya', () => {
    expect(pillarLabel('kenal', 'praktik_dokter')).toBe('Kenal dokternya');
    expect(pillarLabel('kenal', 'klinik')).toBe('Kenal tempatnya');
    expect(pillarLabel('biaya', 'klinik')).toBe('Tahu biayanya');
  });
});

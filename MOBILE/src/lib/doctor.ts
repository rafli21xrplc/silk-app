/** Kata yang bukan bagian nama inti: gelar depan dan penanda data contoh ("Contoh"). */
const NOT_NAME = /^(dr|drg|prof|ns|apt|bd|contoh)\.?$/i;

/** Inisial dari nama inti ("dr. Contoh Rahma Putri, Sp.A" → "RP"). */
export function doctorInitials(name: string): string {
  const words = name
    .split(',')[0]!
    .split(/\s+/)
    .filter((w) => w && !NOT_NAME.test(w) && /\p{L}/u.test(w));
  const core = words.length > 0 ? words : name.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  return core
    .slice(0, 2)
    .map((w) => w.match(/\p{L}/u)![0]!.toUpperCase())
    .join('');
}

export const AVATAR_TONES = [
  'bg-mint text-mint-ink',
  'bg-sky text-sky-ink',
  'bg-peach text-peach-ink',
  'bg-lilac text-lilac-ink',
  'bg-lemon text-lemon-ink',
  'bg-primary-50 text-primary-700',
] as const;

/** Warna avatar stabil per nama (FNV-1a), agar dokter tanpa foto mudah dibedakan. */
export function avatarTone(name: string): (typeof AVATAR_TONES)[number] {
  let h = 0x811c9dc5;
  for (const ch of name.normalize('NFC')) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

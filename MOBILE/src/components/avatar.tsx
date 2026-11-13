import { cn } from '@/lib/cn';
import { avatarTone, doctorInitials } from '@/lib/doctor';

const SIZE = { sm: 'size-11 text-sm', md: 'size-14 text-lg', lg: 'size-20 text-2xl' } as const;

/** Foto dokter atau inisial berwarna stabil bila belum ada foto. */
export function Avatar({ name, photoUrl, size = 'md', className }: { name: string; photoUrl: string | null; size?: keyof typeof SIZE; className?: string }) {
  const base = cn('shrink-0 overflow-hidden rounded-full', SIZE[size], className);
  if (photoUrl) {
    // <img> biasa: media profil dari R2 (domain dinamis) sudah dikompres saat unggah.
    return <img src={photoUrl} alt={name} className={cn(base, 'object-cover')} loading="lazy" />;
  }
  return (
    <span className={cn(base, 'grid place-items-center font-bold tracking-wide', avatarTone(name))} aria-hidden="true">
      {doctorInitials(name)}
    </span>
  );
}

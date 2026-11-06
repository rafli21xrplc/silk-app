import { cn } from '@/lib/cn';
import { doctorInitials } from '@/lib/doctor';

const SIZE = { sm: 'size-12 text-base', md: 'size-16 text-xl', lg: 'size-28 text-3xl sm:size-32' } as const;

/** Foto dokter (foto pertama profil praktik) atau inisial bila belum ada foto. */
export function DoctorAvatar({ name, photoUrl, size = 'md', className }: { name: string; photoUrl: string | null; size?: keyof typeof SIZE; className?: string }) {
  const base = cn('shrink-0 overflow-hidden rounded-full border border-line', SIZE[size], className);
  if (photoUrl) return <img src={photoUrl} alt={name} className={cn(base, 'object-cover')} loading={size === 'lg' ? 'eager' : 'lazy'} />;
  return (
    <span className={cn(base, 'grid place-items-center bg-primary-50 font-semibold text-primary-700')} aria-hidden="true">
      {doctorInitials(name)}
    </span>
  );
}

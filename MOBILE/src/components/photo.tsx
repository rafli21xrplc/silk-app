import { cn } from '@/lib/cn';
import type { Photo } from '@/lib/photos';
import { t } from '@/messages/id';

/** Foto lebar di header profil; foto ilustrasi selalu diberi keterangan di pojok. */
export function HeroPhoto({ photo, ratio = 'wide', className }: { photo: Photo; ratio?: 'wide' | 'portrait'; className?: string }) {
  return (
    <figure className={cn('relative m-0 overflow-hidden rounded-2xl bg-surface-2', ratio === 'wide' ? 'aspect-[16/9]' : 'aspect-[4/3]', className)}>
      {/* <img> biasa: berkas sudah dipotong sesuai ukuran (public/demo) atau media R2 yang dikompres saat unggah. */}
      <img
        src={photo.wide}
        alt={photo.illustrative ? `${photo.alt} (${t.common.illustrative.toLowerCase()})` : photo.alt}
        className="size-full object-cover"
        decoding="async"
      />
      {photo.illustrative && (
        <figcaption
          className="absolute right-2 bottom-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white"
          title={photo.credit ?? undefined}
        >
          {t.common.illustrative}
        </figcaption>
      )}
    </figure>
  );
}

/** Gambar mini persegi di baris daftar (dekoratif: nama ada di sebelahnya). */
export function Thumb({ photo, className }: { photo: Photo | null; className?: string }) {
  if (!photo) return null;
  return <img src={photo.square} alt="" className={cn('size-14 shrink-0 rounded-xl bg-surface-2 object-cover', className)} loading="lazy" decoding="async" />;
}

import { BackButton } from './back-button';

/**
 * Bilah atas halaman dalam: tombol kembali, judul ringkas, dan aksi opsional di kanan.
 * `heading`: judul bilah menjadi h1, untuk halaman yang tidak punya judul besar sendiri.
 */
export function TopBar({ title, backHref = '/', action, heading = false }: { title: string; backHref?: string; action?: React.ReactNode; heading?: boolean }) {
  const Title = heading ? 'h1' : 'p';
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-canvas/90 backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-2">
        <BackButton fallbackHref={backHref} />
        <Title className="m-0 min-w-0 flex-1 truncate text-base font-semibold">{title}</Title>
        {action}
      </div>
    </header>
  );
}

import { BackButton } from './back-button';

/** Bilah atas halaman dalam: tombol kembali, judul ringkas, dan aksi opsional di kanan. */
export function TopBar({ title, backHref = '/', action }: { title: string; backHref?: string; action?: React.ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-canvas/90 backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-2">
        <BackButton fallbackHref={backHref} />
        <p className="m-0 min-w-0 flex-1 truncate text-[0.95rem] font-semibold">{title}</p>
        {action}
      </div>
    </header>
  );
}

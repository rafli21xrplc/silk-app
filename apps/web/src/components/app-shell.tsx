'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import Link from 'next/link';
import { ArrowUpRight, ChevronsLeft, ChevronsRight, CornerDownLeft, LogOut, Menu, Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NavItem } from './account-nav';
import { Logo } from './logo';
import { AppShellSkeleton } from './ui/skeleton';
import { authApi } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { clearQueryCache } from '@/lib/query-cache';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';

const COLLAPSE_KEY = 'silk.sidebar.collapsed';
const GROUP_ORDER = ['main', 'moderation', 'data', 'system', 'partner', 'account'];

/** Satu menu aktif: yang paling spesifik (awalan terpanjang) dari alamat sekarang. */
export function activeHref(pathname: string, nav: { href: string }[]): string | null {
  let best: string | null = null;
  for (const { href } of nav) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

const rank = (key: string) => {
  const i = GROUP_ORDER.indexOf(key);
  return i === -1 ? GROUP_ORDER.length : i;
};

/** Kelompokkan menu sesuai urutan tetap; menu tanpa kelompok masuk "Utama". */
export function groupNav(nav: NavItem[]): { key: string; items: NavItem[] }[] {
  const groups = new Map<string, NavItem[]>();
  for (const item of nav) {
    const key = item.group ?? 'main';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([key, items]) => ({ key, items }));
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Kerangka admin dan portal: sidebar berkelompok (bisa diciutkan), topbar dengan judul halaman,
 * pencarian menu (Ctrl/⌘ K), dan laci menu di ponsel. Navbar dan footer situs disembunyikan di area ini.
 */
export function AppShell({
  me,
  title,
  area,
  nav,
  actions,
  children,
}: {
  me: Me;
  /** Judul halaman (h1). */
  title: string;
  /** Nama area di atas judul, mis. "Panel admin". */
  area?: string;
  nav: NavItem[];
  /** Tombol tambahan di kanan topbar. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const active = activeHref(pathname, nav);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // Penyimpanan diblokir: tetap lebar.
    }
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
      } catch {
        // abaikan
      }
      return !v;
    });

  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi('/sign-out', {});
    } finally {
      clearQueryCache();
      router.replace('/masuk');
    }
  }, [router]);

  const sidebar = (mode: 'rail' | 'drawer') => (
    <SidebarBody
      me={me}
      nav={nav}
      active={active}
      area={area}
      collapsed={mode === 'rail' && collapsed}
      onToggle={mode === 'rail' ? toggleCollapsed : undefined}
      onSearch={() => {
        setDrawer(false);
        setPalette(true);
      }}
      onLogout={logout}
    />
  );

  return (
    <div data-akun data-app-shell className="flex min-h-dvh bg-canvas">
      <aside
        aria-label={area ?? title}
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-white transition-[width] duration-300 ease-soft lg:block',
          collapsed ? 'w-[76px]' : 'w-[272px]',
        )}
      >
        {sidebar('rail')}
      </aside>

      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px] lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-[min(300px,86vw)] bg-white shadow-lift outline-none lg:hidden"
          >
            <Dialog.Title className="sr-only">{area ?? title}</Dialog.Title>
            <Dialog.Close className="absolute top-4 right-3 z-10 grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">{t.nav.closeMenu}</span>
            </Dialog.Close>
            {sidebar('drawer')}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="-ml-1 grid size-10 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-surface-2 lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
            <span className="sr-only">{t.nav.openMenu}</span>
          </button>
          <div className="min-w-0 flex-1 py-2">
            {area && <p className="m-0 truncate text-xs font-semibold tracking-wide text-muted uppercase">{area}</p>}
            <h1 className="m-0 truncate text-lg leading-tight font-bold tracking-tight sm:text-xl">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="grid size-10 place-items-center rounded-xl border border-line bg-white text-ink-soft hover:border-primary-200 hover:text-primary-700 sm:hidden"
            >
              <Search className="size-[18px]" aria-hidden="true" />
              <span className="sr-only">{t.shell.searchMenu}</span>
            </button>
            <Link
              href="/"
              className="hidden h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink-soft no-underline hover:border-primary-200 hover:text-primary-700 hover:no-underline sm:inline-flex"
            >
              {t.shell.viewSite}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
            <span
              className="hidden size-10 place-items-center rounded-full bg-primary-100 text-sm font-bold text-primary-800 sm:grid"
              title={`${me.user.name} · ${me.user.email}`}
              aria-hidden="true"
            >
              {initialsOf(me.user.name)}
            </span>
          </div>
        </header>
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </div>

      <CommandMenu open={palette} onOpenChange={setPalette} nav={nav} />
    </div>
  );
}

function SidebarBody({
  me,
  nav,
  active,
  area,
  collapsed,
  onToggle,
  onSearch,
  onLogout,
}: {
  me: Me;
  nav: NavItem[];
  active: string | null;
  area?: string;
  collapsed: boolean;
  onToggle?: () => void;
  onSearch: () => void;
  onLogout: () => void;
}) {
  const groups = useMemo(() => groupNav(nav), [nav]);
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 shrink-0 items-center gap-2 border-b border-line/70', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        {collapsed ? (
          <Link href="/" aria-label={t.nav.home} className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white no-underline">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12h4l2.5-5 4 10 2.5-5H21" />
            </svg>
          </Link>
        ) : (
          <Logo />
        )}
        {onToggle && !collapsed && (
          <button
            type="button"
            onClick={onToggle}
            title={t.shell.collapse}
            className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:bg-surface-2 hover:text-ink"
          >
            <ChevronsLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">{t.shell.collapse}</span>
          </button>
        )}
      </div>

      <div className={cn('shrink-0 pt-4', collapsed ? 'px-3' : 'px-4')}>
        {onToggle && collapsed && (
          <button
            type="button"
            onClick={onToggle}
            title={t.shell.expand}
            className="mb-2 grid h-10 w-full place-items-center rounded-xl border border-line text-muted hover:bg-surface-2 hover:text-ink"
          >
            <ChevronsRight className="size-4" aria-hidden="true" />
            <span className="sr-only">{t.shell.expand}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onSearch}
          title={collapsed ? t.shell.searchMenu : undefined}
          className={cn(
            'flex h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-white text-sm text-muted transition-colors hover:border-primary-200 hover:text-ink',
            collapsed ? 'justify-center' : 'px-3',
          )}
        >
          <Search className="size-[18px] shrink-0" aria-hidden="true" />
          {collapsed ? (
            <span className="sr-only">{t.shell.searchMenu}</span>
          ) : (
            <>
              <span className="flex-1 text-left">{t.shell.searchMenu}</span>
              <kbd className="hidden rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-[0.7rem] font-semibold text-muted [@media(pointer:fine)]:inline">
                {mac ? '⌘' : 'Ctrl'} K
              </kbd>
            </>
          )}
        </button>
      </div>

      <nav aria-label={area ?? t.nav.menu} className={cn('min-h-0 flex-1 overflow-y-auto pt-2 pb-4', collapsed ? 'px-3' : 'px-4')}>
        {groups.map((g) => (
          <div key={g.key} className="mt-4 first:mt-2">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-8 bg-line" aria-hidden="true" />
            ) : (
              <p className="m-0 mb-1.5 px-3 text-xs font-semibold tracking-wide text-muted uppercase">{t.shell.groups[g.key] ?? g.key}</p>
            )}
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {g.items.map((n) => {
                const current = n.href === active;
                const Icon = n.icon;
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={current ? 'page' : undefined}
                      title={collapsed ? n.label : undefined}
                      data-nav={n.href}
                      className={cn(
                        'relative flex h-11 items-center gap-3 rounded-xl text-[0.95rem] font-medium no-underline transition-colors hover:no-underline',
                        collapsed ? 'justify-center' : 'px-3',
                        current ? 'bg-primary-50 font-semibold text-primary-800' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      {current && !collapsed && <span aria-hidden="true" className="absolute top-2 bottom-2 -left-4 w-1 rounded-r-full bg-primary-600" />}
                      {Icon && <Icon className={cn('size-[19px] shrink-0', current ? 'text-primary-700' : 'text-muted')} strokeWidth={current ? 2.3 : 2} aria-hidden="true" />}
                      {collapsed ? (
                        <span className="sr-only">{n.label}</span>
                      ) : (
                        <span className="min-w-0 flex-1 truncate">{n.label}</span>
                      )}
                      {!!n.badge && (
                        <span
                          className={cn(
                            'grid min-w-6 place-items-center rounded-full bg-warn-soft px-1.5 text-xs font-bold text-warn tabular-nums',
                            collapsed && 'absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[0.65rem]',
                          )}
                        >
                          <span aria-hidden="true">{n.badge > 99 ? '99+' : n.badge}</span>
                          <span className="sr-only">{t.shell.pendingCount(n.badge)}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('shrink-0 border-t border-line/70', collapsed ? 'p-3' : 'p-4')}>
        <div className={cn('flex items-center gap-3 rounded-2xl border border-line bg-surface/60', collapsed ? 'flex-col p-2' : 'p-2.5')}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-600 font-bold text-white" title={collapsed ? me.user.name : undefined} aria-hidden="true">
            {initialsOf(me.user.name)}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-semibold">{me.user.name}</p>
              <p className="m-0 truncate text-xs text-muted">{me.user.email}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            title={t.nav.logout}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <LogOut className="size-[18px]" aria-hidden="true" />
            <span className="sr-only">{t.nav.logout}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pencarian menu (Ctrl/⌘ K): ketik nama halaman, Enter untuk membuka. */
function CommandMenu({ open, onOpenChange, nav }: { open: boolean; onOpenChange: (v: boolean) => void; nav: NavItem[] }) {
  const router = useRouter();
  const groups = useMemo(() => groupNav(nav), [nav]);
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t.shell.searchMenu}
      // Cocok sebagian pada nama menu (bukan fuzzy): "audit" hanya menemukan "Log audit".
      filter={(value, search) => (value.toLocaleLowerCase('id').includes(search.trim().toLocaleLowerCase('id')) ? 1 : 0)}
      overlayClassName="sheet-overlay fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px]"
      contentClassName="fixed top-[12vh] left-1/2 z-50 w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-lift outline-none"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-5 shrink-0 text-muted" aria-hidden="true" />
        <Command.Input
          placeholder={t.shell.searchPlaceholder}
          className="h-14 w-full border-0 bg-transparent text-base text-ink outline-none placeholder:text-muted focus:shadow-none"
        />
        <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-[0.7rem] font-semibold text-muted">Esc</kbd>
      </div>
      <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted">{t.shell.searchEmpty}</Command.Empty>
        {groups.map((g) => (
          <Command.Group
            key={g.key}
            heading={t.shell.groups[g.key] ?? g.key}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase"
          >
            {g.items.map((n) => {
              const Icon = n.icon;
              return (
                <Command.Item
                  key={n.href}
                  value={n.label}
                  onSelect={() => go(n.href)}
                  className="flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-[0.95rem] text-ink-soft data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-800"
                >
                  {Icon && <Icon className="size-[18px] shrink-0 text-muted" aria-hidden="true" />}
                  <span className="flex-1">{n.label}</span>
                  {!!n.badge && <span className="text-xs font-semibold text-warn">{t.shell.pendingCount(n.badge)}</span>}
                  <CornerDownLeft className="size-4 text-muted opacity-0 [[data-selected=true]_&]:opacity-100" aria-hidden="true" />
                </Command.Item>
              );
            })}
          </Command.Group>
        ))}
        <Command.Group
          heading={t.shell.viewSite}
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase"
        >
          <Command.Item
            value={`${t.shell.viewSite} beranda`}
            onSelect={() => go('/')}
            className="flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-[0.95rem] text-ink-soft data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-800"
          >
            <ArrowUpRight className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
            <span className="flex-1">{t.shell.viewSite}</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

/** Selagi sesi dimuat: kerangka portal/admin; bila gagal: pesan galat. */
export function Loading({ error }: { error?: string | null }) {
  if (!error) return <AppShellSkeleton />;
  return (
    <div className="container">
      <p className="error" role="alert">
        {error}
      </p>
    </div>
  );
}

export function FormError({ error }: { error: string | null }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}

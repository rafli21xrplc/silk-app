import { t } from '@/messages/id';
import { AccountLink } from './account-link';
import { HeaderFrame } from './header-frame';
import { Logo } from './logo';
import { MobileMenu } from './mobile-menu';
import { NavLink } from './nav-link';

const LINKS = [
  { href: '/cari', label: t.nav.search },
  { href: '/layanan', label: t.nav.services },
  { href: '/artikel', label: t.nav.articles },
  { href: '/metodologi', label: t.nav.methodology },
];

export function SiteHeader() {
  return (
    <HeaderFrame>
      <div className="container relative flex min-h-[68px] items-center justify-between gap-4 transition-[min-height] duration-300 ease-soft group-data-[scrolled=true]/header:min-h-[60px]">
        <Logo />
        <nav aria-label={t.nav.main} className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <AccountLink className="min-h-10" />
          <MobileMenu>
            {LINKS.map((l) => (
              <NavLink key={l.href} href={l.href} className="rounded-xl px-4 py-3 text-base">
                {l.label}
              </NavLink>
            ))}
          </MobileMenu>
        </div>
      </div>
    </HeaderFrame>
  );
}

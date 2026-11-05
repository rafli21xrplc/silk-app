import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { breadcrumbLd } from '@/lib/seo';
import { JsonLd } from './json-ld';

/** Breadcrumb tampak + JSON-LD BreadcrumbList (aturan SEO 3). */
export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-sm text-muted">
          {items.map((it, i) => (
            <li key={it.path} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 text-line-strong" aria-hidden="true" />}
              {i === items.length - 1 ? (
                <span aria-current="page" className="font-medium text-ink-soft">
                  {it.name}
                </span>
              ) : (
                <Link href={it.path} className="text-muted no-underline hover:text-primary-800 hover:underline">
                  {it.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbLd(items)} />
    </>
  );
}

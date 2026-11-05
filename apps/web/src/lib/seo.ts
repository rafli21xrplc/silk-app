import type { FacilityDetail, PractitionerDetail } from './types';
import { SITE_URL } from './config';
import { t } from '../messages/id';

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * JSON-LD MedicalOrganization (M1-4). Tidak memakai Review/AggregateRating karena SILK tidak punya ulasan.
 */
export function medicalOrganizationLd(f: FacilityDetail) {
  return {
    '@context': 'https://schema.org',
    '@type': f.type === 'rumah_sakit' ? 'Hospital' : f.type === 'apotek' ? 'Pharmacy' : 'MedicalOrganization',
    '@id': absoluteUrl(`/faskes/${f.slug}`),
    name: f.name,
    url: absoluteUrl(`/faskes/${f.slug}`),
    ...(f.description ? { description: f.description } : {}),
    ...(f.phone ? { telephone: f.phone } : {}),
    ...(f.website ? { sameAs: [f.website] } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: f.address,
      addressLocality: f.city,
      addressRegion: f.province,
      addressCountry: 'ID',
    },
    ...(f.location ? { geo: { '@type': 'GeoCoordinates', latitude: f.location.lat, longitude: f.location.lng } } : {}),
    ...(f.tariffs.length
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: t.facility.tariffs,
            itemListElement: f.tariffs
              .filter((x) => x.price.type !== 'tanya' && x.price.min !== null)
              .map((x) => ({
                '@type': 'Offer',
                itemOffered: { '@type': 'MedicalProcedure', name: x.package?.name ?? x.service.name },
                priceCurrency: 'IDR',
                ...(x.price.max !== null && x.price.max !== x.price.min
                  ? { priceSpecification: { '@type': 'PriceSpecification', minPrice: x.price.min, maxPrice: x.price.max, priceCurrency: 'IDR' } }
                  : { price: x.price.min }),
                validFrom: x.trust.effectiveFrom,
              })),
          },
        }
      : {}),
  };
}

export function physicianLd(p: PractitionerDetail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: p.name,
    url: absoluteUrl(`/dokter/${p.slug}`),
    ...(p.specialty ? { medicalSpecialty: p.specialty } : {}),
    ...(p.facilities.length
      ? { worksFor: p.facilities.map((f) => ({ '@type': 'MedicalOrganization', name: f.name, url: absoluteUrl(`/faskes/${f.slug}`) })) }
      : {}),
  };
}

export function articleLd(a: { title: string; description: string; slug: string; publishedAt: string; updatedAt?: string; author?: string; authorType?: 'Person' | 'Organization' }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    mainEntityOfPage: absoluteUrl(`/artikel/${a.slug}`),
    datePublished: a.publishedAt,
    dateModified: a.updatedAt ?? a.publishedAt,
    ...(a.author ? { author: { '@type': a.authorType ?? 'Person', name: a.author } } : {}),
    publisher: { '@type': 'Organization', name: t.site.name, url: SITE_URL },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

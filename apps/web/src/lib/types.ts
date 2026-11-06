import type { Partner, UserRole } from '@silk/shared';
export type {
  CompareResponse,
  FacilityDetail,
  FacilityListItem,
  PractitionerDetail,
  PractitionerListItem,
  PractitionerSpecialty,
  PortalArticle,
  PublicArticle,
  PublicArticleSummary,
  AdminArticleDetail,
  AdminArticleListItem,
  PublicTariff,
  ServiceDetail,
  ServiceCategory,
  ServiceListItem,
  TariffHistoryItem,
  Trust,
  Price,
} from '@silk/shared';

export interface SitemapData {
  facilities: { path: string; lastModified: string | null }[];
  practitioners: { path: string; lastModified: string | null }[];
  services: { path: string; lastModified: string | null }[];
  compare: { path: string; lastModified: string | null }[];
}

export interface Me {
  user: { id: string; email: string; name: string; phone: string | null; role: UserRole; emailVerified: boolean; twoFactorEnabled: boolean };
  memberships: { id: string; slug: string; name: string; city: string; type: string; status: string; verification: string; role: string }[];
  partner: Partner | null;
}

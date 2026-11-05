export type {
  CompareResponse,
  FacilityDetail,
  FacilityListItem,
  PractitionerDetail,
  PublicTariff,
  ServiceDetail,
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
  user: { id: string; email: string; name: string; role: 'faskes' | 'moderator' | 'admin'; emailVerified: boolean; twoFactorEnabled: boolean };
  memberships: { id: string; slug: string; name: string; city: string; status: string; verification: string; role: string }[];
}

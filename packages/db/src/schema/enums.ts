import { pgEnum } from 'drizzle-orm/pg-core';
import { customType } from 'drizzle-orm/pg-core';
import {
  ARTICLE_STATUSES,
  ENTITY_STATUSES,
  FACILITY_TYPES,
  MEDIA_KINDS,
  PARTNER_STATUSES,
  PARTNER_TYPES,
  PRICE_TYPES,
  REVIEW_STATUSES,
  SCHEDULE_KINDS,
  TARIFF_REQUEST_KINDS,
  VERIFICATION_LEVELS,
} from '@silk/shared';

export const facilityType = pgEnum('facility_type', FACILITY_TYPES);
export const verificationLevel = pgEnum('verification_level', VERIFICATION_LEVELS);
export const priceType = pgEnum('price_type', PRICE_TYPES);
export const entityStatus = pgEnum('entity_status', ENTITY_STATUSES);
export const partnerType = pgEnum('partner_type', PARTNER_TYPES);
export const partnerStatus = pgEnum('partner_status', PARTNER_STATUSES);
export const scheduleKind = pgEnum('schedule_kind', SCHEDULE_KINDS);
export const mediaKind = pgEnum('media_kind', MEDIA_KINDS);
export const reviewStatus = pgEnum('review_status', REVIEW_STATUSES);
export const articleStatus = pgEnum('article_status', ARTICLE_STATUSES);
export const tariffRequestKind = pgEnum('tariff_request_kind', TARIFF_REQUEST_KINDS);

/**
 * Kolom PostGIS `geography(Point, 4326)`. Tulis dengan `pointSql(lat, lng)` dari `../geo`,
 * baca dengan `ST_Y(location::geometry)` / `ST_X(location::geometry)` di repo.
 */
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(Point, 4326)';
  },
});

export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

export const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'inet';
  },
});

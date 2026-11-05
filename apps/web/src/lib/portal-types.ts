import type { MediaKind, ReviewStatus, ScheduleKind } from '@silk/shared';

/** Bentuk respons portal Fase 2 (GET/PUT /v1/portal/facilities/:id). */
export interface PortalLocation {
  id?: string;
  label: string | null;
  address: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
  isPrimary: boolean;
}

export interface PortalSchedule {
  id?: string;
  kind: ScheduleKind;
  weekday: number;
  start: string;
  end: string;
  timezone: string;
  practitionerId: string | null;
  note: string | null;
}

export interface PortalMedia {
  id: string;
  kind: MediaKind;
  fileName: string;
  mime: string;
  sizeBytes: number;
  durationSec: number | null;
  caption: string | null;
  status: ReviewStatus;
  rejectionReason: string | null;
  url: string | null;
  createdAt: string;
}

export interface RevisionView {
  id: string;
  status: ReviewStatus;
  payload: Record<string, unknown>;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface PortalProfile {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  address: string;
  city: string;
  province: string;
  phone: string | null;
  website: string | null;
  hours: Record<string, string> | null;
  verification: string;
  status: 'draft' | 'menunggu_tinjauan' | 'terbit' | 'ditarik';
  lat: number | null;
  lng: number | null;
  updatedAt: string;
  locations: PortalLocation[];
  schedules: PortalSchedule[];
  media: PortalMedia[];
  practitioners: { id: string; name: string; specialty: string | null; status: string }[];
  pendingRevision: RevisionView | null;
  lastRevision: RevisionView | null;
}

export interface Presigned {
  uploadUrl: string;
  headers: Record<string, string>;
  objectKey: string;
}

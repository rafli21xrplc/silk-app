import { z } from 'zod';
import {
  compareRowSchema,
  facilityDetailSchema,
  facilityListItemSchema,
  practitionerDetailSchema,
  practitionerListItemSchema,
  practitionerSpecialtySchema,
  publicArticleSchema,
  publicArticleSummarySchema,
  serviceCategorySchema,
  serviceDetailSchema,
  serviceListItemSchema,
} from '@silk/shared';

/**
 * Data cadangan untuk demo (dibuat `pnpm --filter @silk/mobile snapshot` dari API SILK).
 * Dipakai bila API tidak terjangkau, lambat, atau mengirim data yang tidak lolos skema.
 * Semua bagian memakai skema yang sama dengan respons API, jadi tampilannya identik.
 */
export const snapshotSchema = z.object({
  generatedAt: z.string(),
  categories: z.array(serviceCategorySchema),
  services: z.array(serviceListItemSchema),
  serviceDetails: z.record(z.string(), serviceDetailSchema),
  /** Baris perbandingan per layanan, semua wilayah digabung. */
  compare: z.record(z.string(), z.array(compareRowSchema)),
  facilities: z.array(facilityListItemSchema),
  facilityDetails: z.record(z.string(), facilityDetailSchema),
  practitioners: z.array(practitionerListItemSchema),
  practitionerDetails: z.record(z.string(), practitionerDetailSchema),
  specialties: z.array(practitionerSpecialtySchema),
  articles: z.array(publicArticleSummarySchema),
  articleDetails: z.record(z.string(), publicArticleSchema),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

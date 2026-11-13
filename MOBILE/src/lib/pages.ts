import { z } from 'zod';
import { facilityListItemSchema, practitionerListItemSchema } from '@silk/shared';

/** Bentuk respons route handler daftar (/api/faskes, /api/dokter); divalidasi juga di peramban. */
const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable(), source: z.enum(['live', 'demo']) });

export const facilityPageSchema = pageOf(facilityListItemSchema);
export const doctorPageSchema = pageOf(practitionerListItemSchema);
export type FacilityPage = z.infer<typeof facilityPageSchema>;
export type DoctorPage = z.infer<typeof doctorPageSchema>;

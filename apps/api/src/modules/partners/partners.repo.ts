import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import { searchAny } from '../../lib/sql';
import { partners, user, type DbOrTx } from '@silk/db';
import type { PartnerStatus, PartnerType, PartnerUpsertInput } from '@silk/shared';

/** Kolom publik tabel partners (tanpa verified_by dan practitioner_id). */
const columns = {
  id: partners.id,
  userId: partners.userId,
  partnerType: partners.partnerType,
  businessName: partners.businessName,
  licenseNo: partners.licenseNo,
  status: partners.status,
  rejectionReason: partners.rejectionReason,
  verifiedAt: partners.verifiedAt,
  specialty: partners.specialty,
  strNo: partners.strNo,
  facilityKind: partners.facilityKind,
  roomCount: partners.roomCount,
  field: partners.field,
  siaNo: partners.siaNo,
  createdAt: partners.createdAt,
  updatedAt: partners.updatedAt,
};

export async function findByUser(db: DbOrTx, userId: string) {
  const [row] = await db.select(columns).from(partners).where(eq(partners.userId, userId)).limit(1);
  return row ?? null;
}

export async function findById(db: DbOrTx, id: string) {
  const [row] = await db.select(columns).from(partners).where(eq(partners.id, id)).limit(1);
  return row ?? null;
}

/** Kunci baris mitra milik pengguna (bila ada) agar dua PUT bersamaan tidak saling menimpa. */
export async function lockByUser(db: DbOrTx, userId: string) {
  const result = await db.execute<{ id: string }>(sql`SELECT id FROM partners WHERE user_id = ${userId} FOR UPDATE`);
  return result.rows[0] ?? null;
}

export async function lockById(db: DbOrTx, id: string) {
  const result = await db.execute<{ id: string; status: PartnerStatus }>(
    sql`SELECT id, status FROM partners WHERE id = ${id} FOR UPDATE`,
  );
  return result.rows[0] ?? null;
}

/** Atribut per jenis; kolom milik jenis lain selalu NULL. */
function attributes(input: PartnerUpsertInput) {
  return {
    partnerType: input.partnerType,
    businessName: input.businessName,
    licenseNo: input.licenseNo,
    specialty: input.partnerType === 'tenaga_medis' ? input.specialty : null,
    strNo: input.partnerType === 'tenaga_medis' ? input.strNo : null,
    facilityKind: input.partnerType === 'fasilitas' ? input.facilityKind : null,
    roomCount: input.partnerType === 'fasilitas' ? (input.roomCount ?? null) : null,
    field: input.partnerType === 'gaya_hidup' ? input.field : null,
    siaNo: input.partnerType === 'apotek' ? input.siaNo : null,
  };
}

export async function insertPartner(db: DbOrTx, userId: string, input: PartnerUpsertInput) {
  const [row] = await db
    .insert(partners)
    .values({ userId, ...attributes(input), status: 'pending' })
    .returning(columns);
  return row!;
}

/** Simpan perubahan data dan kembalikan ke antrean verifikasi (status pending). */
export async function resubmitPartner(db: DbOrTx, id: string, input: PartnerUpsertInput) {
  const [row] = await db
    .update(partners)
    .set({
      ...attributes(input),
      status: 'pending',
      rejectionReason: null,
      verifiedAt: null,
      verifiedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(partners.id, id))
    .returning(columns);
  return row!;
}

export async function decidePartner(
  db: DbOrTx,
  id: string,
  d: { status: 'verified'; verifiedBy: string | null } | { status: 'rejected'; rejectionReason: string },
) {
  const now = new Date();
  const [row] = await db
    .update(partners)
    .set(
      d.status === 'verified'
        ? { status: 'verified', verifiedAt: now, verifiedBy: d.verifiedBy, rejectionReason: null, updatedAt: now }
        : { status: 'rejected', verifiedAt: null, verifiedBy: null, rejectionReason: d.rejectionReason, updatedAt: now },
    )
    .where(eq(partners.id, id))
    .returning(columns);
  return row!;
}

export function partnerQueue(
  db: DbOrTx,
  f: { status: PartnerStatus; type?: PartnerType; q?: string; limit: number; offset: number },
) {
  const where: SQL[] = [eq(partners.status, f.status)];
  if (f.type) where.push(eq(partners.partnerType, f.type));
  const search = searchAny(f.q, [partners.businessName, user.name, user.email]);
  if (search) where.push(search);
  return db
    .select({ ...columns, userEmail: user.email, userName: user.name })
    .from(partners)
    .innerJoin(user, eq(user.id, partners.userId))
    .where(and(...where))
    .orderBy(asc(partners.createdAt), asc(partners.id))
    .limit(f.limit + 1)
    .offset(f.offset);
}

export async function userContact(db: DbOrTx, userId: string) {
  const [row] = await db.select({ email: user.email, name: user.name, role: user.role }).from(user).where(eq(user.id, userId));
  return row ?? null;
}

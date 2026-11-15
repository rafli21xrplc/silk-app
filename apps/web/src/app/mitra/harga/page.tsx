import { redirect } from 'next/navigation';

/** Alamat lama SILK versi sebelumnya; harga kini satu halaman dengan pendaftaran mitra. */
export default function PartnerPricingRedirect() {
  redirect('/mitra#harga');
}

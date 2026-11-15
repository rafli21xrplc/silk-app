import { activeCampaigns, type CampaignArt } from '@silk/shared';
import type { CampaignSlide } from '@/components/campaign-carousel';
import { categoryPhoto } from '@/demo/photos';

/** Foto kategori untuk ilustrasi banner; `partner` dan `guide` memakai ikon. */
const ART_PHOTO: Partial<Record<CampaignArt, string>> = {
  lab: 'laboratorium',
  mcu: 'mcu',
  doctor: 'konsultasi',
  hospital: 'rawat-inap',
};

/** Campaign yang tayang pada `now`, siap untuk karusel mobile (tujuan `href.mobile`). */
export function campaignSlides(now: Date): CampaignSlide[] {
  return activeCampaigns(now).map((c) => {
    const key = ART_PHOTO[c.art];
    return {
      id: c.id,
      eyebrow: c.eyebrow,
      title: c.title,
      body: c.body,
      cta: c.cta,
      href: c.href.mobile,
      theme: c.theme,
      art: c.art,
      image: key ? (categoryPhoto(key)?.square ?? null) : null,
    };
  });
}

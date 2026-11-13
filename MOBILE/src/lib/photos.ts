import { demoDoctorPhoto, demoFacilityPhoto } from '@/demo/photos';

export interface Photo {
  /** Persegi kecil: avatar dan gambar mini di daftar. */
  square: string;
  /** Lebar: header profil. */
  wide: string;
  alt: string;
  /** true = foto ilustrasi data demo (wajib diberi keterangan di layar). */
  illustrative: boolean;
  credit: string | null;
}

/**
 * Foto dokter: foto dari API (media yang disetujui dokter) selalu didahulukan;
 * foto ilustrasi hanya untuk dokter data demo.
 */
export function doctorPhoto(slug: string, apiUrl: string | null | undefined, name: string): Photo | null {
  if (apiUrl) return { square: apiUrl, wide: apiUrl, alt: name, illustrative: false, credit: null };
  const demo = demoDoctorPhoto(slug);
  return demo
    ? {
        square: demo.square,
        wide: demo.wide,
        alt: demo.alt,
        illustrative: true,
        credit: demo.credit,
      }
    : null;
}

type Media = { kind: string; url: string; mime: string; caption: string | null };

/** Foto faskes: foto pertama dari media yang disetujui; bila tidak ada, ilustrasi untuk faskes data demo. */
export function facilityPhoto(slug: string, media: readonly Media[] = [], name = ''): Photo | null {
  const img = media.find((m) => m.mime.startsWith('image/'));
  if (img)
    return {
      square: img.url,
      wide: img.url,
      alt: img.caption ?? name,
      illustrative: false,
      credit: null,
    };
  const demo = demoFacilityPhoto(slug);
  return demo
    ? {
        square: demo.square,
        wide: demo.wide,
        alt: demo.alt,
        illustrative: true,
        credit: demo.credit,
      }
    : null;
}

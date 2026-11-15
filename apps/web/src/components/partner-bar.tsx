'use client';

import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { t } from '@/messages/id';

const KEY = 'silk.partnerBar.hidden';
/** Tidak tampil di halaman yang sudah untuk mitra/staf. */
const HIDDEN_ON = ['/mitra', '/portal', '/admin', '/akun'];

/**
 * Bar informasi "Daftar mitra" di atas header (dari SILK versi lama). Bisa ditutup; pilihan disimpan per
 * peramban. Dirender di server (tanpa geser tata letak bagi pengunjung baru), lalu disembunyikan bila sudah ditutup.
 */
export function PartnerBar() {
  const pathname = usePathname() ?? '/';
  const [show, setShow] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === '1') setShow(false);
    } catch {
      /* penyimpanan diblokir: tetap tampil */
    }
  }, []);
  if (!show || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  function close() {
    setShow(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* penyimpanan diblokir: cukup sembunyikan untuk kunjungan ini */
    }
  }

  return (
    <div className="border-b border-primary-100 bg-primary-50 text-sm text-primary-900" data-partner-bar>
      <div className="container relative flex items-center justify-center gap-2 py-2 pr-10 text-center sm:gap-3">
        <p className="m-0">
          {t.partnerBar.text}{' '}
          <Link href="/mitra" className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-primary-800">
            {t.partnerBar.cta}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </p>
        <button
          type="button"
          onClick={close}
          aria-label={t.partnerBar.close}
          className="absolute right-3 grid size-8 place-items-center rounded-full text-primary-800 hover:bg-primary-100"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

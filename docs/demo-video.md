# Video perkenalan dokter untuk demo (evaluasi USP R7)

Target demo 20 Desember 2026: 3–5 dokter punya video perkenalan yang tampil di atas lipatan profilnya.
Dokumen ini untuk tim yang merekam dan operator yang memasukkan videonya.

## 1. Brief rekaman

| Hal | Ketentuan |
| --- | --- |
| Durasi | 20–90 detik (ditolak sistem di luar rentang ini) |
| Berkas | MP4 (H.264 + AAC), maks. 50 MB; 1280×720 sudah cukup |
| Orientasi | Mendatar 16:9 (tampil di kotak 16:9 di profil) |
| Isi | Nama dan bidang, tempat dan jam praktik, layanan yang dilayani, cara pasien menyiapkan kunjungan |
| Dilarang | Janji sembuh, klaim "terbaik"/"termurah", menyebut harga (harga tampil dari data tarif, bukan dari video), wajah pasien atau rekam medis |
| Teks/keterangan | Opsional, maks. 200 karakter, lolos aturan konten M17 |

Poster video memakai foto profil dokter (atau inisial bila belum ada foto); tidak perlu unggahan poster terpisah.

## 2. Formulir persetujuan

Setiap orang yang tampil menandatangani formulir sebelum videonya diunggah. Simpan sebagai PDF, JPEG, atau PNG (maks. 5 MB).
Isi minimal (sesuai versi teks `video-2026-11`):

> **Persetujuan Tampil di Video SILK**
>
> Saya, ______________________ (nama lengkap), menyetujui video perkenalan yang menampilkan diri saya
> ditayangkan di profil SILK atas nama ______________________ (nama dokter/praktik).
>
> ☐ Saya juga menyetujui video ini dipakai di media sosial resmi SILK.
>
> Pernyataan medis di video berasal dari saya, bukan dari SILK. Saya dapat mencabut persetujuan ini kapan
> saja; video akan dihapus dari SILK.
>
> Tempat, tanggal: ______________________ Tanda tangan: ______________________

Dokter yang mengunggah sendiri lewat portal dengan akun tenaga medisnya cukup mencentang pernyataan di akun;
formulir di atas wajib untuk jalur skrip dan untuk unggahan oleh akun faskes.

Profil demo "dr. Contoh …" adalah tokoh fiktif. Bila orang yang tampil memerankan tokoh fiktif, nyatakan hal itu
di formulir. Untuk demo yang paling meyakinkan, buat profil dokter sungguhan lewat portal (atas izin dokternya)
dan pakai slug profil itu di manifest.

## 3. Memasukkan video

1. Taruh berkas di `demo-media/` di akar repo. Folder ini di-gitignore: video dan formulir memuat data pribadi,
   jangan di-commit atau dibagikan di kanal publik.
2. Tulis `demo-media/video-demo.json`:

   ```json
   {
     "videos": [
       {
         "practitionerSlug": "dr-contoh-sari-wulandari-sp-og",
         "videoFile": "sari.mp4",
         "consentFile": "sari-persetujuan.pdf",
         "subjectName": "Nama orang yang tampil",
         "socialMedia": false,
         "caption": "Perkenalan dan jam praktik"
       }
     ]
   }
   ```

   `practitionerSlug` harus dokter yang sudah terbit dan punya profil praktik terbit (video menempel di profil
   praktik utamanya). Nama berkas tanpa folder; satu dokter satu video.
3. Jalankan ke database dev/demo (bukan produksi tanpa persetujuan pemilik sistem):

   ```sh
   corepack pnpm --filter @silk/api demo-videos                                   # masuk antrean moderasi
   corepack pnpm --filter @silk/api demo-videos -- --moderator moderator@contoh.id  # langsung disetujui
   ```

   Tanpa `--moderator`, setujui video di `/admin/moderasi` → tab Media; ringkasan persetujuan dan tautan
   formulir tampil di kartu media. Skrip aman diulang: profil yang sudah punya video aktif dilewati.

Tiap impor dicatat di `audit_logs` (`media.import_demo`); persetujuan moderator dicatat sebagai `media.approve`.
Menghapus video dari portal mencabut persetujuannya (`media.consent.revoke`).

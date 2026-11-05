import { Resend } from 'resend';
import { env, isProduction, isTest } from './env';
import { logger } from './logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Jenis email untuk log (tanpa alamat penerima). */
  kind: string;
}

/** Kotak keluar uji: diisi hanya saat NODE_ENV=test agar uji bisa memeriksa email. */
export const testOutbox: EmailMessage[] = [];

let resend: Resend | undefined;

export async function sendEmail(message: EmailMessage): Promise<void> {
  const e = env();
  if (isTest()) {
    testOutbox.push(message);
    return;
  }
  if (!e.RESEND_API_KEY) {
    if (isProduction()) throw new Error('RESEND_API_KEY belum diisi');
    // Dev: tampilkan isi agar tautan verifikasi bisa dipakai. Jangan aktif di produksi.
    logger.info({ kind: message.kind, subject: message.subject, text: message.text }, 'email (dev, tidak dikirim)');
    return;
  }
  resend ??= new Resend(e.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: e.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  if (error) {
    logger.error({ kind: message.kind, err: error.message }, 'gagal mengirim email');
    throw new Error(`Gagal mengirim email: ${error.message}`);
  }
  logger.info({ kind: message.kind }, 'email terkirim');
}

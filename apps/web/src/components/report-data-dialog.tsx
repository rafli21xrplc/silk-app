'use client';

import { Flag } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/client-api';
import { track } from '@/lib/analytics';
import { t } from '@/messages/id';
import { Turnstile } from './turnstile';

/** Form laporan data salah (M14). Bukan ulasan bebas; Turnstile wajib di produksi. */
export function ReportDataDialog({ tariffId, facilityId, service }: { tariffId: string; facilityId: string; service: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | undefined>();

  async function submit(form: FormData) {
    setStatus('sending');
    setError(null);
    try {
      await api('POST', '/reports', {
        tariffId,
        reason: String(form.get('reason') ?? ''),
        contactEmail: String(form.get('email') ?? '') || undefined,
        turnstileToken: token,
      });
      track('report_submitted', { facility_id: facilityId, service });
      setStatus('done');
    } catch (err) {
      setError(errorMessage(err));
      setStatus('idle');
    }
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full px-1 py-1 font-semibold text-muted transition-colors hover:text-danger"
        onClick={() => ref.current?.showModal()}
      >
        <Flag className="size-4" aria-hidden="true" />
        {t.facility.report}
      </button>
      <dialog ref={ref} className="dialog" aria-labelledby={`report-${tariffId}`}>
        <h2 id={`report-${tariffId}`}>{t.report.title}</h2>
        {status === 'done' ? (
          <p>{t.report.thanks}</p>
        ) : (
          <form action={submit} className="form">
            <label>
              {t.report.reason}
              <textarea name="reason" required minLength={10} maxLength={1000} rows={4} />
              <span className="help">{t.report.reasonHelp}</span>
            </label>
            <label>
              {t.report.email}
              <input name="email" type="email" maxLength={200} />
            </label>
            <Turnstile onToken={setToken} />
            {error && <p className="error" role="alert">{error}</p>}
            <div className="actions justify-end">
              <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
                {t.report.submit}
              </button>
              <button type="button" className="btn" onClick={() => ref.current?.close()}>
                {t.report.cancel}
              </button>
            </div>
          </form>
        )}
        {status === 'done' && (
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            {t.common.close}
          </button>
        )}
      </dialog>
    </>
  );
}

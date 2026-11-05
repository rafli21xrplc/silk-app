'use client';

import { t } from '@/messages/id';

/** Formulir tolak dengan alasan wajib (5–1000 karakter), sesuai `rejectReasonSchema`. */
export function RejectForm({ busy, onReject, compact }: { busy: boolean; onReject: (reason: string) => void; compact?: boolean }) {
  return (
    <form
      className={compact ? 'grid gap-2' : 'card stack'}
      onSubmit={(e) => {
        e.preventDefault();
        onReject(String(new FormData(e.currentTarget).get('reason') ?? '').trim());
      }}
    >
      <label>
        {t.admin.reason}
        <textarea name="reason" rows={2} minLength={5} maxLength={1000} required />
      </label>
      <button type="submit" className="btn-danger justify-self-start" disabled={busy}>
        {t.admin.reject}
      </button>
    </form>
  );
}

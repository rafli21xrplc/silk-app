'use client';

import { Workflow } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/client-api';
import { t } from '@/messages/id';
import { DataPanel } from '@/components/ui/data-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/skeleton';
import { AdminShell, useAdminData } from '../admin-shell';

const JOBS = ['process-queue', 'stale-reminders', 'retention'] as const;

export default function AdminJobsPage() {
  return <AdminShell>{(me) => <Jobs isAdmin={me.user.role === 'admin'} />}</AdminShell>;
}

function Jobs({ isAdmin }: { isAdmin: boolean }) {
  const { items, error, reload, handle } =
    useAdminData<{ type: string; status: string; n: number }[]>('/admin/jobs');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(type: string) {
    setBusy(true);
    try {
      const { data } = await api<unknown>('POST', `/admin/jobs/${type}/run`);
      setResult(JSON.stringify(data, null, 2));
      reload();
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <p className="error">{error}</p>}
      {items === null && !error && <LoadingTable />}
      {items && items.length === 0 && (
        <EmptyState icon={Workflow} title={t.admin.emptyState.jobs.title}>
          {t.admin.emptyState.jobs.body}
        </EmptyState>
      )}
      {items && items.length > 0 && (
        <DataPanel label={t.admin.jobs}>
          <table>
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">{t.common.status}</th>
                <th scope="col">n</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={`${r.type}-${r.status}`}>
                  <th scope="row">{r.type}</th>
                  <td>{r.status}</td>
                  <td>{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      )}
      {isAdmin && (
        <div className="actions mt-5">
          {JOBS.map((j) => (
            <button key={j} type="button" className="btn" disabled={busy} onClick={() => run(j)}>
              {t.admin.runJob}: {j}
            </button>
          ))}
        </div>
      )}
      {result && (
        <>
          <h3>{t.admin.lastRun}</h3>
          <pre className="code">{result}</pre>
        </>
      )}
    </>
  );
}

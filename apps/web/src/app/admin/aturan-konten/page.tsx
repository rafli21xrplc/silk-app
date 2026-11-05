'use client';

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { CONTENT_RULE_KINDS, CONTENT_RULE_LEVELS } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { Select } from '@/components/ui/select';
import { api, errorMessage } from '@/lib/client-api';
import { t } from '@/messages/id';
import { DataPanel } from '@/components/ui/data-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/skeleton';
import { AdminShell, useAdminData, useLocalPages } from '../admin-shell';

interface Rule {
  id: number;
  pattern: string;
  kind: string;
  level: string;
  active: boolean;
}

export default function AdminRulesPage() {
  return <AdminShell>{() => <Rules />}</AdminShell>;
}

function Rules() {
  const { items, error, reload, handle } = useAdminData<Rule[]>('/admin/content-rules');
  const { rows, pagination } = useLocalPages(items);
  const [formError, setFormError] = useState<string | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setFormError(null);
    try {
      await api('POST', '/admin/content-rules', {
        pattern: String(f.get('pattern')).trim(),
        kind: f.get('kind'),
        level: f.get('level'),
      });
      form.reset();
      reload();
    } catch (err) {
      handle(err);
      setFormError(errorMessage(err));
    }
  }

  async function toggle(rule: Rule) {
    try {
      await api('PATCH', `/admin/content-rules/${rule.id}`, { active: !rule.active });
      reload();
    } catch (err) {
      handle(err);
    }
  }

  return (
    <>
      <form onSubmit={create} className="card stack">
        <h2>{t.admin.addRule}</h2>
        <FormError error={formError} />
        <div className="row">
          <label className="grow">
            {t.admin.pattern}
            <input name="pattern" required minLength={2} maxLength={200} />
          </label>
          <label>
            {t.admin.kind}
            <Select
              name="kind"
              defaultValue="kata"
              label={t.admin.kind}
              options={CONTENT_RULE_KINDS.map((k) => ({ value: k, label: k }))}
            />
          </label>
          <label>
            {t.admin.level}
            <Select
              name="level"
              defaultValue="blokir"
              label={t.admin.level}
              options={CONTENT_RULE_LEVELS.map((l) => ({ value: l, label: l }))}
            />
          </label>
        </div>
        <button type="submit" className="btn-primary">
          {t.admin.addRule}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {items === null && !error && <LoadingTable />}
      {rows?.length === 0 && (
        <EmptyState icon={ShieldCheck} title={t.admin.emptyState.rules.title}>
          {t.admin.emptyState.rules.body}
        </EmptyState>
      )}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} label={t.admin.rules}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.admin.pattern}</th>
                <th scope="col">{t.admin.kind}</th>
                <th scope="col">{t.admin.level}</th>
                <th scope="col">{t.admin.active}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.active ? undefined : 'row-stale'}>
                  <th scope="row">
                    <code>{r.pattern}</code>
                  </th>
                  <td>{r.kind}</td>
                  <td>{r.level}</td>
                  <td>
                    <label className="checkbox">
                      <input type="checkbox" checked={r.active} onChange={() => toggle(r)} />{' '}
                      {r.active ? t.common.yes : t.common.no}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      )}
    </>
  );
}

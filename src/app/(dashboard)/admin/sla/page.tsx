'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { RefreshCw, Save } from 'lucide-react';

type SlaRow = {
  id: string;
  memo_id: string;
  step_order: number;
  due_at: string;
  status: string;
  reminded_at?: string;
  breached_at?: string;
  memo?: { reference_number?: string; subject?: string };
  assignee?: { full_name?: string; email?: string };
};

type SlaSetting = {
  id?: string;
  role_slug: string;
  sla_hours: number;
  reminder_hours_before: number;
  escalation_enabled?: boolean;
};

export default function AdminSlaPage() {
  const [tracking, setTracking] = useState<SlaRow[]>([]);
  const [settings, setSettings] = useState<SlaSetting[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<Record<string, SlaSetting>>({});
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/sla?status=${status}`);
      const data = await res.json();
      setTracking(data.tracking || []);
      const s = data.settings || [];
      setSettings(s);
      const draft: Record<string, SlaSetting> = {};
      for (const row of s) draft[row.role_slug] = { ...row };
      setSettingsDraft(draft);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runChecks() {
    setRunning(true);
    try {
      const res = await apiFetch('/api/admin/sla?action=run_checks', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`SLA checks complete. Reminded: ${data.reminded}, Breached: ${data.breached}`);
        await load();
      } else {
        alert(data.error || 'Failed');
      }
    } finally {
      setRunning(false);
    }
  }

  async function saveSetting(roleSlug: string) {
    const row = settingsDraft[roleSlug];
    if (!row) return;
    setSavingRole(roleSlug);
    try {
      const res = await apiFetch('/api/admin/sla/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_slug: roleSlug,
          sla_hours: row.sla_hours,
          reminder_hours_before: row.reminder_hours_before,
          escalation_enabled: row.escalation_enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingRole(null);
    }
  }

  function patchDraft(roleSlug: string, patch: Partial<SlaSetting>) {
    setSettingsDraft((prev) => ({
      ...prev,
      [roleSlug]: { ...prev[roleSlug], ...patch },
    }));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">SLA Tracking</h1>
      <p className="text-slate-500 text-sm mb-6">
        Monitor deadlines and configure default SLA hours per approver role. Schedule hourly{' '}
        <code className="text-xs bg-slate-100 px-1 rounded">/api/cron/sla?secret=...</code> in
        production.
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        {(['active', 'breached', 'resolved'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          onClick={runChecks}
          disabled={running}
          className="btn-primary text-sm flex items-center gap-2 ml-auto"
        >
          <RefreshCw size={16} className={running ? 'animate-spin' : ''} />
          Run SLA checks now
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card overflow-x-auto">
          {loading ? (
            <p className="p-6 text-slate-400">Loading...</p>
          ) : tracking.length === 0 ? (
            <p className="p-6 text-slate-400 text-center">No {status} SLA records.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3">Memo</th>
                  <th className="text-left p-3">Assignee</th>
                  <th className="text-left p-3">Due</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tracking.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="p-3">
                      <Link
                        href={`/memos/${row.memo_id}`}
                        className="font-mono text-brand-700 text-xs hover:underline"
                      >
                        {row.memo?.reference_number}
                      </Link>
                      <p className="text-slate-500 truncate max-w-[200px]">{row.memo?.subject}</p>
                    </td>
                    <td className="p-3">{row.assignee?.full_name || '—'}</td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">
                      {new Date(row.due_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {row.breached_at ? (
                        <span className="text-red-600 font-medium">Breached</span>
                      ) : row.reminded_at ? (
                        <span className="text-amber-600">Reminded</span>
                      ) : (
                        <span className="text-brand-600">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold mb-3">SLA settings by role</h2>
          <p className="text-xs text-slate-500 mb-4">
            Used when a memo enters each approval step. Save per role after editing.
          </p>
          <ul className="space-y-4">
            {settings.map((s) => {
              const d = settingsDraft[s.role_slug] || s;
              const changed =
                d.sla_hours !== s.sla_hours ||
                d.reminder_hours_before !== s.reminder_hours_before;
              return (
                <li key={s.role_slug} className="border-b border-slate-100 pb-4 last:border-0">
                  <p className="font-medium text-sm capitalize mb-2">
                    {s.role_slug.replace(/_/g, ' ')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <label className="text-xs text-slate-500">SLA (hours)</label>
                      <input
                        type="number"
                        min={1}
                        className="input-field py-1.5 mt-0.5"
                        value={d.sla_hours}
                        onChange={(e) =>
                          patchDraft(s.role_slug, {
                            sla_hours: parseInt(e.target.value, 10) || 24,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Remind before (hours)</label>
                      <input
                        type="number"
                        min={0}
                        className="input-field py-1.5 mt-0.5"
                        value={d.reminder_hours_before}
                        onChange={(e) =>
                          patchDraft(s.role_slug, {
                            reminder_hours_before: parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveSetting(s.role_slug)}
                    disabled={!changed || savingRole === s.role_slug}
                    className="btn-primary text-xs mt-2 flex items-center gap-1 disabled:opacity-40"
                  >
                    <Save size={12} />
                    {savingRole === s.role_slug ? 'Saving...' : 'Save'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

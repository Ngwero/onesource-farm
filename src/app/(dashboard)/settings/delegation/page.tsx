'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api/client';
import type { RoleSlug } from '@/types';

type DelegationRow = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  delegate?: { full_name?: string; email?: string };
  original?: { full_name?: string };
};

const APPROVER_ROLES: RoleSlug[] = [
  'department_head',
  'it_checker_first',
  'it_checker_second',
  'finance_reviewer',
  'hr_reviewer',
  'ceo',
  'exco_member',
  'admin',
];

export default function DelegationPage() {
  const { user } = useAuth();
  const role = user?.role?.slug as RoleSlug | undefined;
  const [created, setCreated] = useState<DelegationRow[]>([]);
  const [actingFor, setActingFor] = useState<DelegationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    delegated_to_email: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const load = useCallback(async () => {
    const res = await apiFetch('/api/delegations');
    const data = await res.json();
    if (res.ok) {
      setCreated(data.created || []);
      setActingFor(data.acting_for || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role && APPROVER_ROLES.includes(role)) void load();
    else setLoading(false);
  }, [role, load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ delegated_to_email: '', start_date: '', end_date: '', reason: '' });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this delegation?')) return;
    const res = await apiFetch('/api/delegations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) await load();
  }

  if (!role || !APPROVER_ROLES.includes(role)) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Approval Delegation</h1>
        <p className="text-slate-500 text-sm">Delegation is only available for approver roles.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Approval Delegation</h1>
        <p className="text-slate-500 text-sm">
          Delegate your approval authority while you are away. Your delegate can approve memos on
          your behalf; signatures show a delegation note.
        </p>
      </div>

      {actingFor.length > 0 && (
        <div className="card p-4 border-brand-200 bg-brand-50/50">
          <h2 className="font-semibold text-sm mb-2">You are currently acting for</h2>
          <ul className="text-sm space-y-1">
            {actingFor.map((d) => (
              <li key={d.id}>
                {d.original?.full_name} until {d.end_date}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <h2 className="font-semibold">New delegation</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Delegate email</label>
          <input
            type="email"
            className="input-field"
            value={form.delegated_to_email}
            onChange={(e) => setForm({ ...form, delegated_to_email: e.target.value })}
            required
            placeholder="colleague@rukapay.co.ug"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Start date</label>
            <input
              type="date"
              className="input-field"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End date</label>
            <input
              type="date"
              className="input-field"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Reason</label>
          <textarea
            className="input-field min-h-[72px]"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            required
            placeholder="Annual leave, travel, etc."
          />
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Create delegation'}
        </button>
      </form>

      <div className="card p-5">
        <h2 className="font-semibold mb-3">Your delegations</h2>
        {loading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : created.length === 0 ? (
          <p className="text-slate-400 text-sm">No delegations yet.</p>
        ) : (
          <ul className="space-y-3">
            {created.map((d) => (
              <li key={d.id} className="flex justify-between items-start text-sm border-b pb-2">
                <div>
                  <p className="font-medium">{d.delegate?.full_name}</p>
                  <p className="text-slate-500">{d.delegate?.email}</p>
                  <p className="text-slate-400 text-xs mt-1">
                    {d.start_date} → {d.end_date} · {d.status}
                  </p>
                </div>
                {d.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => cancel(d.id)}
                    className="text-red-600 text-xs hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Mail, Plus, RefreshCw, Save, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const TEST_PASSWORD_HINT = 'Test@RukaPay2026';
const ONBOARDING_PASSWORD_HINT = 'Welcome@RukaPay2026';

type LaunchPreview = {
  portalUrl: string;
  effectiveDate: string;
  temporaryPassword: string;
  subject: string;
  recipientCount: number;
  smtpConfigured: boolean;
};

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  title?: string;
  department_id?: string | null;
  role_id?: string;
  departments?: { name: string; code?: string };
  roles?: { name: string; slug: string };
  is_active: boolean;
  must_set_password?: boolean;
};

export default function AdminUsersPage() {
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [userDrafts, setUserDrafts] = useState<
    Record<string, { department_id?: string | null; role_id?: string }>
  >({});
  const [resetting, setResetting] = useState(false);
  const [launchPreview, setLaunchPreview] = useState<LaunchPreview | null>(null);
  const [launchLoading, setLaunchLoading] = useState(false);
  const [launchSending, setLaunchSending] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    title: '',
    department_id: '',
    role_id: '',
  });

  const load = useCallback(() => {
    Promise.all([
      fetch('/api/admin/users', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/lookup', { credentials: 'include' }).then((r) => r.json()),
    ]).then(([usersData, lookup]) => {
      setUsers(usersData.users || []);
      setRoles(lookup.roles || []);
      setDepartments(lookup.departments || []);
    });
  }, []);

  const loadLaunchPreview = useCallback(async () => {
    setLaunchLoading(true);
    try {
      const res = await fetch('/api/admin/launch-announcement', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setLaunchPreview(data.preview);
    } catch {
      /* ignore */
    } finally {
      setLaunchLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    void loadLaunchPreview();
  }, [load, loadLaunchPreview]);

  useEffect(() => {
    if (adminUser?.email && !testEmail) setTestEmail(adminUser.email);
  }, [adminUser?.email, testEmail]);

  async function sendLaunchEmail(allStaff: boolean) {
    const target = allStaff ? 'all active staff' : testEmail;
    const count = allStaff ? launchPreview?.recipientCount ?? users.length : 1;

    if (
      !confirm(
        allStaff
          ? `Send the e-Memo go-live announcement to ALL ${count} active staff?\n\nThis cannot be undone.`
          : `Send a test go-live email to ${testEmail}?`
      )
    ) {
      return;
    }

    setLaunchSending(true);
    try {
      const res = await fetch('/api/admin/launch-announcement', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allStaff ? {} : { testEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');

      if (data.failed > 0) {
        alert(
          `${data.message}\n\nFailed: ${data.failed}\n` +
            (data.failures?.map((f: { email: string; reason?: string }) => `${f.email}: ${f.reason}`).join('\n') ||
              '')
        );
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setLaunchSending(false);
    }
  }

  async function resetLogins(mode: 'test' | 'onboarding', userId?: string) {
    const label =
      mode === 'test'
        ? userId
          ? 'Reset this user to the shared test password?'
          : `Reset ALL ${users.length} users to the shared test password?`
        : userId
          ? 'Reset this user for first-login password setup?'
          : `Reset ALL users to onboarding (temporary password + must change)?`;

    if (!confirm(label)) return;

    setResetting(true);
    try {
      const res = await fetch('/api/admin/users/reset-logins', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      alert(
        `${data.message}\n\nPassword: ${data.password}\n` +
          (mode === 'onboarding'
            ? 'User signs in, then sets a new password on the next screen.'
            : 'Users can sign in directly (no set-password screen).')
      );
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetting(false);
      setSavingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        password: '',
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ email: '', full_name: '', title: '', department_id: '', role_id: '' });
      load();
      alert(
        `User created.\nFirst login: ${ONBOARDING_PASSWORD_HINT}\nThen they set their own password.`
      );
    } else {
      const err = await res.json();
      alert(err.error);
    }
  }

  function patchUserDraft(id: string, patch: { department_id?: string | null; role_id?: string }) {
    setUserDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function getUserDraft(u: UserRow) {
    const draft = userDrafts[u.id];
    return {
      department_id: draft?.department_id !== undefined ? draft.department_id : u.department_id || '',
      role_id: draft?.role_id !== undefined ? draft.role_id : u.role_id || '',
    };
  }

  function userHasChanges(u: UserRow) {
    const draft = userDrafts[u.id];
    if (!draft) return false;
    const currentDept = u.department_id || '';
    const currentRole = u.role_id || '';
    const draftDept = draft.department_id !== undefined ? draft.department_id || '' : currentDept;
    const draftRole = draft.role_id !== undefined ? draft.role_id : currentRole;
    return draftDept !== currentDept || draftRole !== currentRole;
  }

  async function saveUser(id: string) {
    const u = users.find((row) => row.id === id);
    if (!u || !userHasChanges(u)) return;

    const draft = getUserDraft(u);
    setSavingId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department_id: draft.department_id || null,
        role_id: draft.role_id,
      }),
    });
    setSavingId(null);
    if (res.ok) {
      const { user } = await res.json();
      setUsers((list) => list.map((row) => (row.id === id ? { ...row, ...user } : row)));
      setUserDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      const err = await res.json();
      alert(err.error);
      load();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manage Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            Assign department and role per person. Reset logins for testing or first-time setup.
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card p-5 mb-6 border-brand-100 bg-brand-50/40">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <KeyRound size={18} className="text-brand-600" />
          Account & login management
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          <strong>Testing:</strong> shared password <code className="text-xs bg-white px-1 rounded">{TEST_PASSWORD_HINT}</code>{' '}
          (skip set-password screen).{' '}
          <strong>Production onboarding:</strong> temporary{' '}
          <code className="text-xs bg-white px-1 rounded">{ONBOARDING_PASSWORD_HINT}</code>, then user chooses a new password.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={resetting}
            onClick={() => resetLogins('test')}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            <RefreshCw size={14} className={resetting ? 'animate-spin' : ''} />
            Reset all logins (testing)
          </button>
          <button
            type="button"
            disabled={resetting}
            onClick={() => resetLogins('onboarding')}
            className="btn-secondary text-sm inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Reset all (onboarding flow)
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          CLI equivalent: <code className="bg-white px-1 rounded">npm run reset:logins</code> (testing + org workflows)
        </p>
      </div>

      <div className="card p-5 mb-6 border-emerald-100 bg-emerald-50/30">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <Mail size={18} className="text-emerald-700" />
          e-Memo go-live announcement
        </h2>
        <p className="text-sm text-slate-600 mb-3">
          Branded email telling staff e-Memo is live from <strong>Monday, 8 June 2026</strong> for all
          memos and leave requests. Includes temporary password{' '}
          <code className="text-xs bg-white px-1 rounded">{ONBOARDING_PASSWORD_HINT}</code> and link to{' '}
          <strong>{launchPreview?.portalUrl || 'ememo.rukapay.co.ug'}</strong>.
        </p>

        {launchLoading ? (
          <p className="text-sm text-slate-500">Loading preview…</p>
        ) : launchPreview ? (
          <ul className="text-xs text-slate-600 space-y-1 mb-4">
            <li>
              <strong>Subject:</strong> {launchPreview.subject}
            </li>
            <li>
              <strong>Recipients:</strong> {launchPreview.recipientCount} active staff
            </li>
            <li>
              <strong>SMTP:</strong>{' '}
              {launchPreview.smtpConfigured ? (
                <span className="text-emerald-700">Configured</span>
              ) : (
                <span className="text-red-600">Not configured — emails will fail</span>
              )}
            </li>
          </ul>
        ) : null}

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
          <div className="flex-1 max-w-sm">
            <label className="block text-xs font-medium text-slate-600 mb-1">Test email address</label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="input-field text-sm"
              placeholder="you@rukapay.co.ug"
            />
          </div>
          <button
            type="button"
            disabled={launchSending || !testEmail || !launchPreview?.smtpConfigured}
            onClick={() => void sendLaunchEmail(false)}
            className="btn-secondary text-sm inline-flex items-center gap-2"
          >
            <Send size={14} />
            Send test email
          </button>
        </div>

        <button
          type="button"
          disabled={launchSending || !launchPreview?.smtpConfigured || (launchPreview?.recipientCount ?? 0) === 0}
          onClick={() => void sendLaunchEmail(true)}
          className="btn-primary text-sm inline-flex items-center gap-2"
        >
          <Mail size={14} className={launchSending ? 'animate-pulse' : ''} />
          {launchSending ? 'Sending…' : `Send to all staff (${launchPreview?.recipientCount ?? 0})`}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 sm:p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                const email = e.target.value.toLowerCase();
                const local = email.split('@')[0] || '';
                const name = local
                  .split('.')
                  .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                  .join(' ');
                setForm((f) => ({
                  ...f,
                  email,
                  full_name: f.full_name || name,
                  title: f.title || name,
                }));
              }}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Full name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Job title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className="input-field"
            >
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={form.role_id}
              onChange={(e) => setForm({ ...form, role_id: e.target.value })}
              className="input-field"
              required
            >
              <option value="">Select...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-1 sm:col-span-2 text-xs text-slate-500">
            New users sign in with {ONBOARDING_PASSWORD_HINT}, then set their own password.
          </div>
          <div className="col-span-1 sm:col-span-2">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Create User
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => {
              const draft = getUserDraft(u);
              const changed = userHasChanges(u);
              return (
                <tr key={u.id} className={savingId === u.id ? 'opacity-60' : ''}>
                  <td className="px-4 py-3 font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={draft.department_id || ''}
                      onChange={(e) =>
                        patchUserDraft(u.id, { department_id: e.target.value || null })
                      }
                      className="input-field py-1.5 text-sm min-w-[8rem]"
                      disabled={savingId === u.id}
                    >
                      <option value="">Unassigned</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={draft.role_id || ''}
                      onChange={(e) => patchUserDraft(u.id, { role_id: e.target.value })}
                      className="input-field py-1.5 text-sm min-w-[8rem]"
                      disabled={savingId === u.id}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.must_set_password ? (
                      <span className="text-amber-600 text-xs font-medium">Awaiting password setup</span>
                    ) : (
                      <span className={u.is_active ? 'text-brand-600' : 'text-red-500'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2 min-w-[7.5rem]">
                      <button
                        type="button"
                        disabled={!changed || savingId === u.id}
                        onClick={() => void saveUser(u.id)}
                        className="btn-primary text-xs inline-flex items-center gap-1 w-fit disabled:opacity-40"
                      >
                        <Save size={12} />
                        {savingId === u.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        disabled={resetting}
                        onClick={() => {
                          setSavingId(u.id);
                          void resetLogins('test', u.id);
                        }}
                        className="text-xs text-brand-700 hover:underline text-left"
                      >
                        Test password
                      </button>
                      <button
                        type="button"
                        disabled={resetting}
                        onClick={() => {
                          setSavingId(u.id);
                          void resetLogins('onboarding', u.id);
                        }}
                        className="text-xs text-slate-600 hover:underline text-left"
                      >
                        Onboarding reset
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

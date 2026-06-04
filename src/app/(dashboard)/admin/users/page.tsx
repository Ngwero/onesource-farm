'use client';

import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Plus, RefreshCw } from 'lucide-react';

const TEST_PASSWORD_HINT = 'Test@RukaPay2026';
const ONBOARDING_PASSWORD_HINT = 'Welcome@RukaPay2026';

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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
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

  useEffect(() => {
    load();
  }, [load]);

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

  async function updateUser(id: string, patch: Partial<UserRow>) {
    setSavingId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSavingId(null);
    if (res.ok) {
      const { user } = await res.json();
      setUsers((list) => list.map((u) => (u.id === id ? { ...u, ...user } : u)));
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

      {showForm && (
        <form onSubmit={handleCreate} className="card p-6 mb-6 grid grid-cols-2 gap-4">
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
          <div className="col-span-2 text-xs text-slate-500">
            New users sign in with {ONBOARDING_PASSWORD_HINT}, then set their own password.
          </div>
          <div className="col-span-2">
            <button type="submit" className="btn-primary">
              Create User
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Login</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className={savingId === u.id ? 'opacity-60' : ''}>
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.department_id || ''}
                    onChange={(e) =>
                      updateUser(u.id, { department_id: e.target.value || null })
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
                    value={u.role_id || ''}
                    onChange={(e) => updateUser(u.id, { role_id: e.target.value })}
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
                  <div className="flex flex-col gap-1 min-w-[7.5rem]">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

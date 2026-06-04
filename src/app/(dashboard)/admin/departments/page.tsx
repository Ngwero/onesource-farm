'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string; is_active: boolean }[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    fetch('/api/admin/departments', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments || []));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/departments', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code: code.toUpperCase() }),
    });
    if (res.ok) {
      const data = await res.json();
      setDepartments((d) => [...d, data.department]);
      setName('');
      setCode('');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Departments</h1>

      <form onSubmit={handleCreate} className="card p-4 mb-6 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Department Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" required />
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium mb-1">Code</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="input-field" required maxLength={5} />
        </div>
        <button type="submit" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add
        </button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {departments.map((d) => (
          <div key={d.id} className="card p-4">
            <p className="font-semibold">{d.name}</p>
            <p className="text-sm text-slate-500 font-mono">{d.code}</p>
            <span className={`text-xs mt-2 inline-block ${d.is_active ? 'text-brand-600' : 'text-red-500'}`}>
              {d.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import { RotateCcw, Trash2 } from 'lucide-react';

type TrashItem = {
  id: string;
  memo_id: string;
  delete_reason: string;
  deleted_at: string;
  memo?: { reference_number?: string; subject?: string };
  deleted_by_user?: { full_name?: string };
};

export default function AdminTrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/trash');
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(memoId: string) {
    setActing(memoId);
    try {
      const res = await apiFetch('/api/admin/trash', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo_id: memoId, action: 'restore' }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Restore failed');
        return;
      }
      await load();
    } finally {
      setActing(null);
    }
  }

  async function permanentDelete(memoId: string) {
    const reason = prompt('Reason for permanent deletion (required):');
    if (!reason?.trim()) return;
    setActing(memoId);
    try {
      const res = await apiFetch('/api/admin/trash', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo_id: memoId,
          action: 'permanent_delete',
          reason: reason.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Delete failed');
        return;
      }
      await load();
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Trash / Recycle Bin</h1>
      <p className="text-slate-500 text-sm mb-6">
        Deleted memos appear here. Restore to draft or permanently delete with audit logging.
      </p>

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <p>No deleted memos in trash.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Reference</th>
                <th className="text-left p-3 font-medium">Subject</th>
                <th className="text-left p-3 font-medium">Deleted</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="p-3 font-mono text-brand-700">
                    {item.memo?.reference_number || item.memo_id.slice(0, 8)}
                  </td>
                  <td className="p-3">{item.memo?.subject || '—'}</td>
                  <td className="p-3 text-slate-500">
                    {new Date(item.deleted_at).toLocaleString()}
                    <br />
                    <span className="text-xs">{item.delete_reason}</span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      type="button"
                      disabled={acting === item.memo_id}
                      onClick={() => restore(item.memo_id)}
                      className="btn-secondary inline-flex items-center gap-1 text-xs"
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                    <button
                      type="button"
                      disabled={acting === item.memo_id}
                      onClick={() => permanentDelete(item.memo_id)}
                      className="btn-danger inline-flex items-center gap-1 text-xs"
                    >
                      <Trash2 size={14} /> Permanent
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

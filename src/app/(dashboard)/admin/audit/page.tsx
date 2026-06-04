'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

type AuditLog = {
  id: string;
  action: string;
  memo_id?: string;
  created_at: string;
  user?: { full_name?: string; email?: string };
  new_values?: Record<string, unknown>;
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/audit?limit=200');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Audit Reports</h1>
      <p className="text-slate-500 text-sm mb-6">
        Full audit trail for compliance review. Export as CSV for spreadsheets.
      </p>

      <div className="flex gap-3 mb-6">
        <button
          type="button"
          onClick={async () => {
            const res = await apiFetch('/api/admin/audit?format=csv&limit=500');
            if (!res.ok) {
              alert('Export failed');
              return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'audit-trail.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="card p-4 flex items-center gap-3 hover:border-brand-300 transition-colors text-left"
        >
          <Download className="text-brand-600" size={22} />
          <div>
            <p className="font-semibold text-sm">Export CSV</p>
            <p className="text-xs text-slate-500">Download audit trail</p>
          </div>
        </button>
        <button type="button" onClick={() => load()} className="btn-secondary text-sm">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading audit log...</p>
      ) : (
        <div className="card overflow-hidden max-h-[32rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left p-3 font-medium">Time</th>
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium">Action</th>
                <th className="text-left p-3 font-medium">Memo</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="p-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">{log.user?.full_name || log.user?.email || '—'}</td>
                  <td className="p-3 font-medium">{log.action.replace(/_/g, ' ')}</td>
                  <td className="p-3 font-mono text-xs text-slate-500">
                    {log.memo_id ? log.memo_id.slice(0, 8) + '…' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <p className="p-8 text-center text-slate-400">No audit entries yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

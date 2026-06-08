'use client';

import type { MemoActivityItem } from '@/lib/memo/memoActivityTypes';
import { formatMemoActivityTime } from '@/lib/memo/memoActivityTypes';

export function MemoActivity({ items }: { items: MemoActivityItem[] }) {
  if (!items.length) {
    return (
      <div className="card p-4">
        <h3 className="font-semibold mb-2">Activity</h3>
        <p className="text-sm text-slate-500">No actions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Activity</h3>
      <ol className="space-y-3 max-h-48 sm:max-h-64 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id} className="text-sm border-l-2 border-slate-200 pl-3">
            <p className="font-medium text-slate-800">
              {item.label}
              {item.adminOverride ? (
                <span className="ml-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  Admin override
                </span>
              ) : null}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatMemoActivityTime(item.at)}
              {item.actor ? ` · ${item.actor}` : ''}
            </p>
            {item.detail ? (
              <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{item.detail}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

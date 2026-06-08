'use client';

import { useState } from 'react';
import { Banknote, ChevronDown, ChevronUp } from 'lucide-react';
import type { MemoFinancialSummary } from '@/lib/memo/financial';
import { formatCurrency } from '@/lib/memo/financial';
import Link from 'next/link';

interface FinancialSummaryProps {
  summary: MemoFinancialSummary;
  title?: string;
}

export function FinancialSummary({
  summary,
  title = 'Total financial implication',
}: FinancialSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const { total, memosWithAmount, memoCount, items } = summary;

  if (memoCount === 0) return null;

  return (
    <section className="card p-5 mb-6 border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
            <Banknote className="text-white" size={22} />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              {title}
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-brand-700 mt-1 tracking-tight">
              {formatCurrency(total)}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              From {memosWithAmount} of {memoCount} memo{memoCount === 1 ? '' : 's'} with amounts in
              the Financial Implication section
              {summary.usd_to_ugx_rate
                ? ` · USD converted at ${summary.usd_to_ugx_rate.toLocaleString('en-UG')} UGX per dollar`
                : ''}
            </p>
          </div>
        </div>

        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="btn-secondary text-sm self-start inline-flex items-center gap-1"
          >
            {expanded ? (
              <>
                Hide breakdown <ChevronUp size={16} />
              </>
            ) : (
              <>
                View breakdown <ChevronDown size={16} />
              </>
            )}
          </button>
        ) : null}
      </div>

      {memosWithAmount === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-4">
          No amounts detected yet. Include figures in UGX (e.g. &quot;UGX 5,000,000&quot;) in each
          memo&apos;s Financial Implication field.
        </p>
      ) : null}

      {expanded && items.length > 0 ? (
        <div className="mt-4 pt-4 border-t border-brand-100">
          <div className="data-table max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Subject</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/memos/${row.id}`}
                        className="font-mono text-xs font-semibold text-brand-600 hover:text-brand-800"
                      >
                        {row.reference_number || row.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate text-slate-700">
                      {row.subject || '—'}
                    </td>
                    <td className="text-right font-semibold text-slate-800 whitespace-nowrap">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="font-semibold text-slate-600 pt-2">
                    Total
                  </td>
                  <td className="text-right font-bold text-brand-700 pt-2 whitespace-nowrap">
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

import type { GradeRef } from '@/lib/farm/types';

export type GradedLine = { quantity: number; grade: Pick<GradeRef, 'id' | 'code' | 'name' | 'purpose' | 'is_reject'> | null };

export type GradingStats = {
  graded: number;
  exportable: number;
  rejected: number;
  exportablePct: number | null;
  rejectionPct: number | null;
  distribution: { id: string; code: string; name: string; purpose: string; quantity: number; pct: number }[];
};

/** Percentages are of the harvested quantity, so they are meaningful even before the grading balances. */
export function gradingStats(lines: GradedLine[], harvested: number): GradingStats {
  const total = Number(harvested) || 0;
  let graded = 0;
  let exportable = 0;
  let rejected = 0;
  const distribution: GradingStats['distribution'] = [];
  for (const l of lines) {
    const q = Number(l.quantity) || 0;
    graded += q;
    if (l.grade?.purpose === 'export') exportable += q;
    if (l.grade?.is_reject) rejected += q;
    if (l.grade && q > 0) {
      distribution.push({
        id: l.grade.id,
        code: l.grade.code,
        name: l.grade.name,
        purpose: l.grade.purpose,
        quantity: q,
        pct: total > 0 ? (q / total) * 100 : 0,
      });
    }
  }
  return {
    graded,
    exportable,
    rejected,
    exportablePct: total > 0 ? (exportable / total) * 100 : null,
    rejectionPct: total > 0 ? (rejected / total) * 100 : null,
    distribution,
  };
}

const PURPOSE_COLOURS: Record<string, string> = {
  export: 'bg-emerald-500',
  local_market: 'bg-sky-500',
  processing: 'bg-amber-500',
  waste: 'bg-red-500',
};

export function purposeColour(purpose: string): string {
  return PURPOSE_COLOURS[purpose] ?? 'bg-slate-400';
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type MemoPeriodFilter = {
  year: number;
  month?: number;
};

export function parseMemoPeriodFilter(
  yearParam: string | null | undefined,
  monthParam: string | null | undefined
): MemoPeriodFilter | null {
  if (!yearParam?.trim()) return null;
  const year = parseInt(yearParam, 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null;

  if (!monthParam?.trim()) {
    return { year };
  }

  const month = parseInt(monthParam, 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { year };
  }

  return { year, month };
}

/** Inclusive start and exclusive end (for memo_date DATE column). */
export function memoDateRangeForPeriod(period: MemoPeriodFilter): {
  start: string;
  endExclusive: string;
} {
  if (period.month) {
    const m = String(period.month).padStart(2, '0');
    const start = `${period.year}-${m}-01`;
    const nextMonth = period.month === 12 ? 1 : period.month + 1;
    const nextYear = period.month === 12 ? period.year + 1 : period.year;
    const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    return { start, endExclusive };
  }

  return {
    start: `${period.year}-01-01`,
    endExclusive: `${period.year + 1}-01-01`,
  };
}

export function formatPeriodLabel(period: MemoPeriodFilter): string {
  if (period.month) {
    return `${MONTH_NAMES[period.month - 1]} ${period.year}`;
  }
  return String(period.year);
}

export function buildYearOptions(anchorYear = new Date().getFullYear(), span = 6): number[] {
  const years: number[] = [];
  for (let y = anchorYear; y >= anchorYear - span; y--) {
    years.push(y);
  }
  return years;
}

export const MEMO_MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({
  value: String(i + 1),
  label: name,
}));

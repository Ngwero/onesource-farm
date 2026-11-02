import { format, parseISO } from 'date-fns';

export function fmtNumber(value: number | string | null | undefined, maxDecimals = 2): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-GB', { maximumFractionDigits: maxDecimals });
}

export function fmtQty(value: number | string | null | undefined, unit?: string | null): string {
  const n = fmtNumber(value);
  return n === '—' || !unit ? n : `${n} ${unit}`;
}

export function fmtMoney(value: number | string | null | undefined, currency?: string | null): string {
  const n = fmtNumber(value, 0);
  return n === '—' || !currency ? n : `${currency} ${n}`;
}

export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-GB', { maximumFractionDigits: decimals })}%`;
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'd MMM yyyy, HH:mm');
  } catch {
    return value;
  }
}

/** `datetime-local` input value → ISO timestamp with the browser's offset applied. */
export function localToIso(value: string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** ISO timestamp → `datetime-local` input value in the browser's time zone. */
export function isoToLocal(value: string | null | undefined): string | null {
  return value ? format(parseISO(value), "yyyy-MM-dd'T'HH:mm") : null;
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'd MMM yyyy');
  } catch {
    return value;
  }
}

export function fmtHa(value: number | string | null | undefined): string {
  const n = fmtNumber(value);
  return n === '—' ? n : `${n} ha`;
}

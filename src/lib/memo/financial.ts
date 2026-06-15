import { DEFAULT_USD_TO_UGX_RATE } from '@/lib/memo/exchangeRate';

export interface MemoFinancialRow {
  id: string;
  reference_number?: string;
  subject?: string;
  amount: number;
}

export interface MemoFinancialSummary {
  total: number;
  currency: string;
  memoCount: number;
  memosWithAmount: number;
  items: MemoFinancialRow[];
  usd_to_ugx_rate?: number;
}

/** Digits with optional thousand separators — no trailing comma. */
const AMOUNT = String.raw`\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?`;
/** k/m/b multiplier only when not the start of a word (avoids ", broken" → billion). */
const MULT = String.raw`\s*([kKmMbB])(?![a-zA-Z])`;

function applyMultiplier(value: number, suffix?: string): number {
  if (!suffix) return value;
  const s = suffix.toLowerCase();
  if (s === 'k') return value * 1_000;
  if (s === 'm') return value * 1_000_000;
  if (s === 'b') return value * 1_000_000_000;
  return value;
}

function normalizeCurrency(token?: string): 'UGX' | 'USD' | 'OTHER' {
  if (!token) return 'UGX';
  const c = token.toUpperCase().replace(/\./g, '');
  if (c === 'USD') return 'USD';
  if (c === 'UGX' || c === 'USH') return 'UGX';
  return 'OTHER';
}

function toUgxAmount(
  raw: string,
  suffix: string | undefined,
  currencyToken: string | undefined,
  usdToUgx: number
): number | null {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;

  let amount = applyMultiplier(n, suffix);
  const currency = normalizeCurrency(currencyToken);

  if (currency === 'USD') {
    amount *= usdToUgx;
  } else if (currency === 'OTHER') {
    return null;
  }

  return amount;
}

function pushParsedAmount(
  amounts: number[],
  raw: string,
  suffix: string | undefined,
  currencyToken: string | undefined,
  usdToUgx: number
) {
  const amount = toUgxAmount(raw, suffix, currencyToken, usdToUgx);
  if (amount !== null) amounts.push(amount);
}

/** Leave memos store structured metadata in financial_implication — not monetary amounts. */
export function isLeaveFinancialMeta(text?: string | null): boolean {
  const raw = text?.trim();
  if (!raw?.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(raw) as { _leave_v?: number; _leave_y?: number };
    return parsed._leave_v === 1 || parsed._leave_y === 1;
  } catch {
    return false;
  }
}

function extractExplicitTotalAmount(
  text: string,
  usdToUgx = DEFAULT_USD_TO_UGX_RATE
): number | null {
  const patterns = [
    new RegExp(
      String.raw`\btotal\s+(?:cost|amount|expenditure|payment|sum)\b(?:\s*\(UGX\))?[^0-9]{0,24}(${AMOUNT})${MULT}?`,
      'i'
    ),
    new RegExp(String.raw`\bamounted\s+to\s+(?:UGX\s*)?(${AMOUNT})${MULT}?`, 'i'),
    new RegExp(
      String.raw`\b(?:approve(?:d)?\s+)?payment\s+of\s+(?:UGX\s*)?(${AMOUNT})${MULT}?`,
      'i'
    ),
    new RegExp(String.raw`\btotal\b[^0-9]{0,16}(?:UGX\s*)?(${AMOUNT})${MULT}?`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const amount = toUgxAmount(match[1], match[2], 'UGX', usdToUgx);
      if (amount !== null) return amount;
    }
  }

  return null;
}

/** Extract monetary amounts from free-text financial implication fields (totals in UGX). */
export function extractAmountsFromFinancialText(
  text: string,
  usdToUgx = DEFAULT_USD_TO_UGX_RATE
): number[] {
  const src = text.trim();
  if (!src || /^n\/?a\.?$/i.test(src)) return [];

  const amounts: number[] = [];

  const currencyFirst = new RegExp(
    String.raw`(UGX|USh\.?|USD)\s*[:.]?\s*(${AMOUNT})${MULT}`,
    'gi'
  );
  let match: RegExpExecArray | null;
  while ((match = currencyFirst.exec(src)) !== null) {
    pushParsedAmount(amounts, match[2], match[3], match[1], usdToUgx);
  }

  const currencyAfter = new RegExp(
    String.raw`(${AMOUNT})${MULT}\s*(UGX|USh\.?|USD)\b`,
    'gi'
  );
  while ((match = currencyAfter.exec(src)) !== null) {
    pushParsedAmount(amounts, match[1], match[2], match[3], usdToUgx);
  }

  const ugxOnlyPatterns = [
    new RegExp(
      String.raw`\b(?:amount|total|cost|payment|budget|sum|worth|price)\b(?:\s+of)?\s*[:.]?\s*(?:UGX\s*)?(${AMOUNT})${MULT}`,
      'gi'
    ),
    new RegExp(
      String.raw`\b(?:approve(?:d)?\s+)?payment\s+of\s+(?:UGX\s*)?(${AMOUNT})${MULT}`,
      'gi'
    ),
  ];

  for (const pattern of ugxOnlyPatterns) {
    while ((match = pattern.exec(src)) !== null) {
      pushParsedAmount(amounts, match[1], match[2], 'UGX', usdToUgx);
    }
  }

  if (amounts.length === 0) {
    const plain = new RegExp(String.raw`\b(${AMOUNT})\b`, 'g');
    while ((match = plain.exec(src)) !== null) {
      pushParsedAmount(amounts, match[1], undefined, 'UGX', usdToUgx);
    }
  }

  return amounts;
}

function pickMemoTotal(amounts: number[]): number {
  if (amounts.length === 1) return amounts[0];

  const rounded = amounts.map((n) => Math.round(n));
  const unique = [...new Set(rounded)];
  if (unique.length === 1) return unique[0];

  const sorted = [...unique].sort((a, b) => b - a);
  const max = sorted[0];
  const othersSum = sorted.slice(1).reduce((sum, n) => sum + n, 0);

  if (Math.abs(max - othersSum) < 1) return max;

  const totalSum = rounded.reduce((sum, n) => sum + n, 0);
  const maxOccurrences = rounded.filter((n) => n === max).length;
  if (maxOccurrences === 1 && totalSum > max) return totalSum;

  return max;
}

/** Single memo total from its financial implication text (in UGX). */
export function getMemoFinancialAmount(
  text?: string | null,
  usdToUgx = DEFAULT_USD_TO_UGX_RATE
): number | null {
  if (!text?.trim() || isLeaveFinancialMeta(text)) return null;

  const explicit = extractExplicitTotalAmount(text, usdToUgx);
  if (explicit !== null) return explicit;

  const amounts = extractAmountsFromFinancialText(text, usdToUgx);
  if (amounts.length === 0) return null;
  return pickMemoTotal(amounts);
}

const EXCLUDED_FINANCIAL_STATUS_SLUGS = new Set(['rejected']);

export function summarizeMemoFinancials(
  memos: Array<{
    id: string;
    reference_number?: string;
    subject?: string;
    financial_implication?: string | null;
    memo_statuses?: { slug?: string } | { slug?: string }[] | null;
  }>,
  usdToUgx = DEFAULT_USD_TO_UGX_RATE
): MemoFinancialSummary {
  const eligible = memos.filter((memo) => {
    const status = memo.memo_statuses;
    const slug = Array.isArray(status) ? status[0]?.slug : status?.slug;
    return !EXCLUDED_FINANCIAL_STATUS_SLUGS.has(slug || '');
  });
  const items: MemoFinancialRow[] = [];

  for (const memo of eligible) {
    const amount = getMemoFinancialAmount(memo.financial_implication, usdToUgx);
    if (amount !== null) {
      items.push({
        id: memo.id,
        reference_number: memo.reference_number,
        subject: memo.subject,
        amount,
      });
    }
  }

  return {
    total: items.reduce((sum, row) => sum + row.amount, 0),
    currency: 'UGX',
    memoCount: eligible.length,
    memosWithAmount: items.length,
    items,
    usd_to_ugx_rate: usdToUgx,
  };
}

export function formatCurrency(amount: number, currency = 'UGX'): string {
  return `${currency} ${amount.toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;
}

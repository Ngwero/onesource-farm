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

/** Extract monetary amounts from free-text financial implication fields (totals in UGX). */
export function extractAmountsFromFinancialText(
  text: string,
  usdToUgx = DEFAULT_USD_TO_UGX_RATE
): number[] {
  const src = text.trim();
  if (!src || /^n\/?a\.?$/i.test(src)) return [];

  const amounts: number[] = [];

  const currencyFirst =
    /(UGX|USh\.?|USD)\s*[:.]?\s*([\d,]+(?:\.\d{1,2})?)\s*([kKmMbB])?/gi;
  let match: RegExpExecArray | null;
  while ((match = currencyFirst.exec(src)) !== null) {
    pushParsedAmount(amounts, match[2], match[3], match[1], usdToUgx);
  }

  const currencyAfter =
    /([\d,]+(?:\.\d{1,2})?)\s*([kKmMbB])?\s*(UGX|USh\.?|USD)\b/gi;
  while ((match = currencyAfter.exec(src)) !== null) {
    pushParsedAmount(amounts, match[1], match[2], match[3], usdToUgx);
  }

  const ugxOnlyPatterns = [
    /(?:amount|total|cost|payment|budget|sum|worth|price)(?:\s+of)?\s*[:.]?\s*(?:UGX\s*)?([\d,]+(?:\.\d{1,2})?)\s*([kKmMbB])?/gi,
    /(?:approve(?:d)?\s+)?payment\s+of\s+(?:UGX\s*)?([\d,]+(?:\.\d{1,2})?)\s*([kKmMbB])?/gi,
  ];

  for (const pattern of ugxOnlyPatterns) {
    while ((match = pattern.exec(src)) !== null) {
      pushParsedAmount(amounts, match[1], match[2], 'UGX', usdToUgx);
    }
  }

  if (amounts.length === 0) {
    const plain = /\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{4,}(?:\.\d+)?)\b/g;
    while ((match = plain.exec(src)) !== null) {
      pushParsedAmount(amounts, match[1], undefined, 'UGX', usdToUgx);
    }
  }

  return amounts;
}

/** Single memo total from its financial implication text (sum of amounts found, in UGX). */
export function getMemoFinancialAmount(
  text?: string | null,
  usdToUgx = DEFAULT_USD_TO_UGX_RATE
): number | null {
  if (!text?.trim()) return null;
  const amounts = extractAmountsFromFinancialText(text, usdToUgx);
  if (amounts.length === 0) return null;
  return amounts.reduce((sum, n) => sum + n, 0);
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

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
}

function applyMultiplier(value: number, suffix?: string): number {
  if (!suffix) return value;
  const s = suffix.toLowerCase();
  if (s === 'k') return value * 1_000;
  if (s === 'm') return value * 1_000_000;
  if (s === 'b') return value * 1_000_000_000;
  return value;
}

function pushAmount(amounts: number[], raw: string, suffix?: string) {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return;
  amounts.push(applyMultiplier(n, suffix));
}

/** Extract monetary amounts from free-text financial implication fields. */
export function extractAmountsFromFinancialText(text: string): number[] {
  const src = text.trim();
  if (!src || /^n\/?a\.?$/i.test(src)) return [];

  const amounts: number[] = [];

  const patterns = [
    /(?:UGX|USh\.?|USD|EUR|GBP)\s*[:.]?\s*([\d,]+(?:\.\d{1,2})?)\s*([kKmMbB])?/gi,
    /([\d,]+(?:\.\d{1,2})?)\s*([kKmMbB])?\s*(?:UGX|USh\.?|USD|EUR|GBP)/gi,
    /(?:amount|total|cost|payment|budget|sum|worth|price)(?:\s+of)?\s*[:.]?\s*(?:UGX\s*)?([\d,]+(?:\.\d{1,2})?)\s*([kKmMbB])?/gi,
    /(?:approve(?:d)?\s+)?payment\s+of\s+(?:UGX\s*)?([\d,]+(?:\.\d{1,2})?)\s*([kKmMbB])?/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(src)) !== null) {
      pushAmount(amounts, match[1], match[2]);
    }
  }

  if (amounts.length === 0) {
    const plain = /\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{4,}(?:\.\d+)?)\b/g;
    let match: RegExpExecArray | null;
    while ((match = plain.exec(src)) !== null) {
      pushAmount(amounts, match[1]);
    }
  }

  return amounts;
}

/** Single memo total from its financial implication text (sum of amounts found). */
export function getMemoFinancialAmount(text?: string | null): number | null {
  if (!text?.trim()) return null;
  const amounts = extractAmountsFromFinancialText(text);
  if (amounts.length === 0) return null;
  return amounts.reduce((sum, n) => sum + n, 0);
}

export function summarizeMemoFinancials(
  memos: Array<{
    id: string;
    reference_number?: string;
    subject?: string;
    financial_implication?: string | null;
  }>
): MemoFinancialSummary {
  const items: MemoFinancialRow[] = [];

  for (const memo of memos) {
    const amount = getMemoFinancialAmount(memo.financial_implication);
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
    memoCount: memos.length,
    memosWithAmount: items.length,
    items,
  };
}

export function formatCurrency(amount: number, currency = 'UGX'): string {
  return `${currency} ${amount.toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;
}

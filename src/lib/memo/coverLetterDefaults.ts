import type { BrandingSettings } from '@/types';

export const MEMO_VISION_STATEMENT =
  'Vision: To Offer Diverse Payment Processing Services to Meet Customer Needs.';

export const DEFAULT_COMPANY_CONTACT = [
  'P.O BOX 111498, 2nd Floor, TMT Building',
  'Bukoto-Ntinda Road, Kampala',
  'Tel: +256 (0) 200 244 400',
  'Email: your system administrator',
];

export function getCompanyContactLines(branding?: Partial<BrandingSettings>): string[] {
  const address = branding?.company_address?.trim();
  if (!address) return DEFAULT_COMPANY_CONTACT;

  const lines = address.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const looksComplete =
    lines.length >= 2 ||
    /p\.?o\.?\s*box|tel:|email:|bukoto|ntinda/i.test(address);

  return looksComplete ? lines : DEFAULT_COMPANY_CONTACT;
}

export function formatMemoDate(date?: string | null): string {
  if (!date) return new Date().toLocaleDateString('en-GB');
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-GB');
}

/** Avoid "Name, Name" when title duplicates the approver name. */
export function formatSignerLine(name?: string, title?: string): string {
  const n = name?.trim() || '';
  const t = title?.trim() || '';
  if (!n) return t;
  if (!t) return n;
  if (n.toLowerCase() === t.toLowerCase()) return n;
  if (t.toLowerCase().includes(n.toLowerCase())) return t;
  if (n.toLowerCase().includes(t.toLowerCase())) return n;
  return `${n}, ${t}`;
}

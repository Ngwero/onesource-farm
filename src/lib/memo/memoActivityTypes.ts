export type MemoActivityItem = {
  id: string;
  at: string;
  label: string;
  actor?: string;
  detail?: string;
  adminOverride?: boolean;
};

export function formatMemoActivityTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('en-UG', { timeZone: 'Africa/Kampala' });
}

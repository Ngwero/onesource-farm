/** Safe term for PostgREST ilike filters (strip wildcards and filter syntax). */
export function sanitizeMemoSearchQuery(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const term = raw.trim().replace(/[%_,().]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
  return term.length >= 2 ? term : null;
}

export function memoSearchOrFilter(term: string): string {
  const pattern = `%${term}%`;
  const fields = [
    'reference_number',
    'subject',
    'memo_from',
    'memo_thru',
    'memo_to',
    'background',
    'justification',
    'recommendation',
    'financial_implication',
  ];
  return fields.map((f) => `${f}.ilike.${pattern}`).join(',');
}

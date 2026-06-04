import type { Memo, MemoStatusSlug, MemoTypeSlug } from '@/types';

export type MemoAccessRow = {
  id: string;
  creator_id: string;
  department_id: string;
  requires_exco?: boolean;
  requires_finance?: boolean;
  memo_types?: { slug: string } | { slug: string }[] | null;
  memo_statuses?: { slug: string } | { slug: string }[] | null;
  departments?: { name?: string; code: string } | { name?: string; code: string }[] | null;
};

/** Normalize Supabase join shape (object or single-element array). */
export function joinSlug(
  rel: { slug: string } | { slug: string }[] | null | undefined
): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.slug;
  return rel.slug;
}

/** Map API/list/detail joins into the shape expected by canApproveMemo / canViewMemo. */
export function rowToMemoForAccess(row: MemoAccessRow): Memo {
  const typeSlug = joinSlug(row.memo_types);
  const statusSlug = joinSlug(row.memo_statuses);
  const deptRel = row.departments;
  const dept = deptRel ? (Array.isArray(deptRel) ? deptRel[0] : deptRel) : undefined;

  return {
    id: row.id,
    reference_number: '',
    memo_type_id: '',
    status_id: '',
    creator_id: row.creator_id,
    department_id: row.department_id,
    current_version: 1,
    current_step_order: 0,
    requires_exco: Boolean(row.requires_exco),
    requires_finance: Boolean(row.requires_finance),
    importance_level: 'normal',
    created_at: '',
    updated_at: '',
    memo_type: typeSlug
      ? { id: '', name: '', slug: typeSlug as MemoTypeSlug }
      : undefined,
    status: statusSlug
      ? {
          id: '',
          name: '',
          slug: statusSlug as MemoStatusSlug,
          sort_order: 0,
        }
      : undefined,
    department: dept?.code
      ? {
          id: row.department_id,
          name: dept.name || '',
          code: dept.code,
          is_active: true,
        }
      : undefined,
  };
}

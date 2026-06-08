import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { filterCreatableMemoTypes } from '@/lib/memo/designatedUsers';
import { fetchMemoPeopleDirectory } from '@/lib/memo/peopleDirectory';

async function getLookupData() {
  const supabase = createServiceClient();

  const [roles, departments, memoTypes, memoStatuses, people] = await Promise.all([
    supabase.from('roles').select('id, name, slug').order('name'),
    supabase.from('departments').select('id, name, code').eq('is_active', true).order('name'),
    supabase.from('memo_types').select('id, name, slug').eq('is_active', true).order('name'),
    supabase.from('memo_statuses').select('id, name, slug, sort_order').order('sort_order'),
    fetchMemoPeopleDirectory(),
  ]);

  const errors = [roles, departments, memoTypes, memoStatuses]
    .map((r) => r.error?.message)
    .filter(Boolean);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }

  return {
    roles: roles.data,
    departments: departments.data,
    memo_types: memoTypes.data,
    memo_statuses: memoStatuses.data,
    people,
  };
}

export async function GET() {
  try {
    const user = await requireAuth();
    const data = await getLookupData();
    return NextResponse.json(
      {
        ...data,
        memo_types: filterCreatableMemoTypes(user, data.memo_types ?? []),
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      }
    );
  } catch (err) {
    return authErrorResponse(err);
  }
}

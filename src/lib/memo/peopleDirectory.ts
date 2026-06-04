import { createServiceClient } from '@/lib/supabase/server';
import { toMemoPersonOption, type MemoPersonOption } from '@/lib/memo/personLine';

const USER_SELECT = `
  id,
  full_name,
  email,
  title,
  departments(name, code),
  roles(name, slug)
`;

/** Active users from DB — single source of truth for memo person fields. */
export async function fetchMemoPeopleDirectory(): Promise<{
  from: MemoPersonOption[];
  routing: MemoPersonOption[];
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('users')
    .select(USER_SELECT)
    .eq('is_active', true)
    .order('full_name');

  if (error) throw error;

  const rows = data || [];
  return {
    from: rows.map((r) => toMemoPersonOption(r, 'from')),
    routing: rows.map((r) => toMemoPersonOption(r, 'routing')),
  };
}

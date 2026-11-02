import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';

/** Every user with their System role and farm roles. */
export async function GET() {
  return withPermission('admin.users', async () => {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('users')
      .select(
        'id, email, full_name, title, is_active, roles(name, slug), departments(name), user_app_roles!user_app_roles_user_id_fkey(role_id)'
      )
      .order('full_name');
    if (error) throw error;

    const users = (data ?? []).map(({ user_app_roles, roles, departments, ...u }) => ({
      ...u,
      ememo_role: (roles as unknown as { name: string; slug: string } | null) ?? null,
      department: (departments as unknown as { name: string } | null)?.name ?? null,
      role_ids: (user_app_roles as { role_id: string }[]).map((r) => r.role_id),
    }));
    return NextResponse.json({ users });
  });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';

/** Roles with their permissions, plus the full permission catalogue. */
export async function GET() {
  return withPermission('admin.users', async () => {
    const supabase = createServiceClient();
    const [rolesRes, permsRes, countsRes] = await Promise.all([
      supabase.from('app_roles').select('id, slug, name, description, is_system, role_permissions(permission_key)').order('name'),
      supabase.from('permissions').select('key, module, description, sort_order').order('sort_order'),
      supabase.from('user_app_roles').select('role_id'),
    ]);
    if (rolesRes.error) throw rolesRes.error;
    if (permsRes.error) throw permsRes.error;
    if (countsRes.error) throw countsRes.error;

    const userCounts = new Map<string, number>();
    for (const r of countsRes.data ?? []) userCounts.set(r.role_id, (userCounts.get(r.role_id) ?? 0) + 1);

    const roles = (rolesRes.data ?? []).map(({ role_permissions, ...role }) => ({
      ...role,
      permission_keys: (role_permissions as { permission_key: string }[]).map((p) => p.permission_key),
      user_count: userCounts.get(role.id) ?? 0,
    }));
    return NextResponse.json({ roles, permissions: permsRes.data ?? [] });
  });
}

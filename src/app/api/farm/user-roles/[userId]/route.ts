import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { userRolesSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ userId: string }> };

export async function PUT(request: Request, { params }: Params) {
  return withPermission('admin.users', async ({ user }) => {
    const { userId } = await params;
    const { role_ids } = await parseBody(request, userRolesSchema);
    const supabase = createServiceClient();

    const [{ data: current, error: loadError }, { data: adminRole, error: adminError }] = await Promise.all([
      supabase.from('user_app_roles').select('role_id').eq('user_id', userId),
      supabase.from('app_roles').select('id').eq('slug', 'system_admin').single(),
    ]);
    if (loadError) throw loadError;
    if (adminError) throw adminError;

    const existing = new Set((current ?? []).map((r) => r.role_id as string));
    const wanted = new Set(role_ids);

    if (userId === user.id && existing.has(adminRole.id) && !wanted.has(adminRole.id)) {
      throw new HttpError('You cannot remove your own System Administrator role.', 400);
    }

    const toAdd = [...wanted].filter((r) => !existing.has(r));
    const toRemove = [...existing].filter((r) => !wanted.has(r));

    if (toAdd.length) {
      const { error } = await supabase
        .from('user_app_roles')
        .insert(toAdd.map((role_id) => ({ user_id: userId, role_id, assigned_by: user.id })));
      if (error) throw error;
    }
    if (toRemove.length) {
      const { error } = await supabase
        .from('user_app_roles')
        .delete()
        .eq('user_id', userId)
        .in('role_id', toRemove);
      if (error) throw error;
    }

    await auditFarm(user.id, 'updated', 'user_app_roles', userId, {
      old: { role_ids: [...existing] },
      new: { role_ids },
    });
    return NextResponse.json({ role_ids });
  });
}

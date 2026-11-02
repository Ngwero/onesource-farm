import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { isPermission } from '@/lib/farm/permissions';
import { rolePermissionsSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  return withPermission('admin.roles', async ({ user }) => {
    const { id: roleId } = await params;
    const { permission_keys } = await parseBody(request, rolePermissionsSchema);
    const unknown = permission_keys.filter((k) => !isPermission(k));
    if (unknown.length) throw new HttpError(`Unknown permissions: ${unknown.join(', ')}`, 400);

    const supabase = createServiceClient();
    const { data: role, error: roleError } = await supabase
      .from('app_roles')
      .select('id, slug, role_permissions(permission_key)')
      .eq('id', roleId)
      .single();
    if (roleError) throw roleError;
    if (role.slug === 'system_admin') {
      throw new HttpError('The System Administrator role always has every permission.', 400);
    }

    const existing = new Set((role.role_permissions as { permission_key: string }[]).map((p) => p.permission_key));
    const wanted = new Set(permission_keys);
    const toAdd = [...wanted].filter((k) => !existing.has(k));
    const toRemove = [...existing].filter((k) => !wanted.has(k));

    if (toAdd.length) {
      const { error } = await supabase
        .from('role_permissions')
        .insert(toAdd.map((permission_key) => ({ role_id: roleId, permission_key })));
      if (error) throw error;
    }
    if (toRemove.length) {
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .in('permission_key', toRemove);
      if (error) throw error;
    }

    await auditFarm(user.id, 'updated', 'role_permissions', roleId, {
      old: { permission_keys: [...existing] },
      new: { permission_keys },
    });
    return NextResponse.json({ permission_keys });
  });
}

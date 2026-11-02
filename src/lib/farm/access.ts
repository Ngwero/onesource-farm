import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { AuthError, requireAuth } from '@/lib/auth/session';
import type { User } from '@/types';
import { PERMISSIONS, isPermission, type FarmAccess, type Permission } from './permissions';
import { handleRouteError, HttpError } from './http';

type RoleRow = {
  role: {
    id: string;
    slug: string;
    name: string;
    role_permissions: { permission_key: string }[];
  } | null;
};

export async function getFarmAccess(user: User): Promise<FarmAccess> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('user_app_roles')
    .select('role:app_roles(id, slug, name, role_permissions(permission_key))')
    .eq('user_id', user.id);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RoleRow[];
  const roles = rows.flatMap((r) => (r.role ? [{ id: r.role.id, slug: r.role.slug, name: r.role.name }] : []));

  // eMemo administrators always keep full access so the system can never be locked out.
  if (user.role?.slug === 'admin') {
    return { roles, permissions: [...PERMISSIONS] };
  }

  const permissions = new Set<Permission>();
  for (const r of rows) {
    for (const p of r.role?.role_permissions ?? []) {
      if (isPermission(p.permission_key)) permissions.add(p.permission_key);
    }
  }
  return { roles, permissions: [...permissions] };
}

export type FarmContext = { user: User; access: FarmAccess; can: (p: Permission) => boolean };

export async function requirePermission(permission?: Permission): Promise<FarmContext> {
  const user = await requireAuth();
  const access = await getFarmAccess(user);
  const can = (p: Permission) => access.permissions.includes(p);
  if (permission && !can(permission)) {
    throw new AuthError('You do not have permission to do this.', 403);
  }
  return { user, access, can };
}

/** Wrap a route handler: authenticate, check a permission and map errors to JSON responses. */
export async function withPermission(
  permission: Permission | undefined,
  handler: (ctx: FarmContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const ctx = await requirePermission(permission);
    return await handler(ctx);
  } catch (err) {
    return handleRouteError(err);
  }
}

/** V1 runs a single farm; all farm-scoped records attach to it. */
export async function getCurrentFarmId(): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('farms')
    .select('id')
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError('No active farm is configured.', 409);
  return data.id as string;
}

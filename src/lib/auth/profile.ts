import type { Role, RoleSlug, User } from '@/types';

/** Resolve role slug from normalized `role` or raw Supabase `roles` join. */
export function getUserRoleSlug(
  user: Pick<User, 'role'> | Record<string, unknown> | null | undefined
): RoleSlug | undefined {
  if (!user) return undefined;
  const normalized = user as User;
  if (normalized.role?.slug) return normalized.role.slug as RoleSlug;
  const roles = (user as Record<string, unknown>).roles as { slug?: string } | null | undefined;
  return roles?.slug as RoleSlug | undefined;
}

/** Normalize Supabase join shape (`roles`) into app `User` shape (`role`). */
export function normalizeUserProfile(raw: Record<string, unknown> | null | undefined): User | null {
  if (!raw?.id) return null;

  const roles = raw.roles as { slug?: string; name?: string } | null | undefined;
  const departments = raw.departments as { name?: string; code?: string } | null | undefined;

  const role: Role | undefined = roles?.slug
    ? {
        id: String(raw.role_id),
        name: roles.name || '',
        slug: roles.slug as RoleSlug,
      }
    : (raw.role as Role | undefined);

  return {
    id: String(raw.id),
    email: String(raw.email),
    full_name: String(raw.full_name),
    title: raw.title as string | undefined,
    department_id: (raw.department_id as string | null) ?? undefined,
    role_id: String(raw.role_id),
    role,
    department: departments
      ? {
          id: String(raw.department_id || ''),
          name: departments.name || '',
          code: departments.code || '',
          is_active: true,
        }
      : undefined,
    signature_path: raw.signature_path as string | undefined,
    signature_uploaded_at: raw.signature_uploaded_at as string | undefined,
    is_active: raw.is_active !== false,
    must_set_password: Boolean(raw.must_set_password),
  };
}

/** Keep role/department when a partial API payload (e.g. signature upload) omits joins. */
export function mergeUserProfile(prev: User | null, incoming: User): User {
  if (!prev) return incoming;
  return {
    ...prev,
    ...incoming,
    role: incoming.role?.slug ? incoming.role : prev.role,
    department: incoming.department?.code ? incoming.department : prev.department,
    signature_path: incoming.signature_path ?? prev.signature_path,
    signature_uploaded_at: incoming.signature_uploaded_at ?? prev.signature_uploaded_at,
  };
}

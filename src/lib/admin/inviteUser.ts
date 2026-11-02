import { createServiceClient } from '@/lib/supabase/server';
import { ONBOARDING_PASSWORD, resetAuthPasswords } from '@/lib/admin/teamAuth';
import { HttpError } from '@/lib/farm/http';
import { sendAccountLoginEmail } from '@/lib/notifications/email';
import type { InviteUserInput } from '@/lib/farm/schemas';

export function portalUrlFromRequest(request: Request): string {
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host')?.trim();
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    (host?.includes('localhost') || host?.startsWith('127.') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export type InvitedUser = {
  id: string;
  email: string;
  full_name: string;
  title: string | null;
  must_set_password: boolean;
  roles: { name: string; slug: string } | null;
  departments: { name: string; code?: string } | null;
};

export type InviteResult = {
  user: InvitedUser;
  emailSent: boolean;
  emailReason?: string;
  temporaryPassword: string;
};

export async function createInvitedUser(
  input: InviteUserInput,
  options: { portalUrl: string; assignedBy?: string | null }
): Promise<InviteResult> {
  const supabase = createServiceClient();
  const email = input.email.trim().toLowerCase();
  const password = ONBOARDING_PASSWORD;

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) throw new HttpError('A user with this email already exists.', 400);

  const { data: role } = await supabase.from('roles').select('id, name').eq('id', input.role_id).maybeSingle();
  if (!role) throw new HttpError('Select a valid role.', 400);

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });
  if (authError) {
    if (/already|exists|registered/i.test(authError.message)) {
      throw new HttpError('A user with this email already exists.', 400);
    }
    throw new HttpError(authError.message, 400);
  }

  const { data: user, error } = await supabase
    .from('users')
    .insert({
      id: authUser.user.id,
      email,
      full_name: input.full_name,
      title: input.title || input.full_name,
      department_id: input.department_id || null,
      role_id: input.role_id,
      is_active: true,
      must_set_password: true,
    })
    .select('id, email, full_name, title, must_set_password, roles(name, slug), departments(name, code)')
    .single();

  if (error || !user) {
    await supabase.auth.admin.deleteUser(authUser.user.id);
    throw error ?? new HttpError('Could not save the user profile.', 500);
  }

  const farmRoleIds = [...new Set(input.farm_role_ids ?? [])];
  if (farmRoleIds.length) {
    const { error: roleErr } = await supabase.from('user_app_roles').insert(
      farmRoleIds.map((role_id) => ({
        user_id: user.id,
        role_id,
        assigned_by: options.assignedBy ?? null,
      }))
    );
    if (roleErr) throw roleErr;
  }

  const invited = user as unknown as InvitedUser;
  return deliverLogin(invited, password, options.portalUrl, input.send_login !== false);
}

export async function sendUserLoginDetails(userId: string, portalUrl: string): Promise<InviteResult> {
  const supabase = createServiceClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, title, must_set_password, roles(name, slug), departments(name, code)')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!user?.email) throw new HttpError('User not found', 404);

  const { failed, password } = await resetAuthPasswords(supabase, 'onboarding', [userId]);
  if (failed > 0) throw new HttpError('Could not set the temporary password.', 500);

  return deliverLogin(user as unknown as InvitedUser, password, portalUrl, true);
}

async function deliverLogin(
  user: InvitedUser,
  password: string,
  portalUrl: string,
  send: boolean
): Promise<InviteResult> {
  if (!send) {
    return { user, emailSent: false, emailReason: 'not_requested', temporaryPassword: password };
  }

  const result = await sendAccountLoginEmail({
    email: user.email,
    fullName: user.full_name || 'Colleague',
    password,
    portalUrl,
    roleName: user.roles?.name,
  });

  return {
    user,
    emailSent: result.sent,
    emailReason: result.reason,
    temporaryPassword: password,
  };
}

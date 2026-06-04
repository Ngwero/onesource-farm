import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';
import {
  listAllAuthUsers,
  ONBOARDING_PASSWORD,
  resetAuthPasswords,
  TEST_PASSWORD,
  type LoginResetMode,
} from '@/lib/admin/teamAuth';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const mode = (body.mode === 'onboarding' ? 'onboarding' : 'test') as LoginResetMode;
    const userId = typeof body.userId === 'string' ? body.userId : undefined;

    const supabase = createServiceClient();

    if (userId) {
      const { data: profile } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (!profile?.id) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const { ok, failed, password } = await resetAuthPasswords(supabase, mode, [userId]);

      if (failed > 0) {
        return NextResponse.json({ error: 'Failed to reset auth password' }, { status: 500 });
      }

      return NextResponse.json({
        ok,
        mode,
        password: mode === 'test' ? TEST_PASSWORD : ONBOARDING_PASSWORD,
        user: profile,
        message:
          mode === 'test'
            ? `${profile.full_name} can sign in with the shared test password.`
            : `${profile.full_name} must sign in with the temporary password, then set a new one.`,
      });
    }

    const authUsers = await listAllAuthUsers(supabase);
    if (authUsers.length === 0) {
      return NextResponse.json({ error: 'No users found' }, { status: 404 });
    }

    const { ok, failed, password } = await resetAuthPasswords(supabase, mode);

    return NextResponse.json({
      ok,
      failed,
      total: authUsers.length,
      mode,
      password,
      message:
        mode === 'test'
          ? `Reset ${ok} account(s) to the shared test password.`
          : `Reset ${ok} account(s) to the onboarding temporary password.`,
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('users')
      .select('*, roles(name, slug), departments(name, code)')
      .order('full_name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: data });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { email, password, full_name, title, department_id, role_id } = await request.json();
    const supabase = createServiceClient();
    const mustSetPassword = !password;

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: password || process.env.TEAM_INITIAL_PASSWORD || 'Welcome@RukaPay2026',
      email_confirm: true,
    });

    if (authError) throw authError;

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        full_name,
        title,
        department_id: department_id || null,
        role_id,
        must_set_password: mustSetPassword,
      })
      .select('*, roles(name, slug), departments(name)')
      .single();

    if (error) throw error;
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

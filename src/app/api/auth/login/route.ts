import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { attachAppSessionCookie } from '@/lib/auth/session';
import { sendWelcomeSignInEmailOnce } from '@/lib/notifications/email';
import { copyResponseCookies, createRouteHandlerClient } from '@/lib/supabase/routeHandler';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const email = String(payload?.email || '').trim().toLowerCase();
    const password = String(payload?.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const authResponse = NextResponse.json({ ok: true });
    const supabase = createRouteHandlerClient(request, authResponse);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const profileClient = createServiceClient();
    const { data: profile } = await profileClient
      .from('users')
      .select('*, roles(slug, name), departments(name, code)')
      .eq('id', authData.user.id)
      .single();

    if (!profile?.is_active) {
      return NextResponse.json({ error: 'Account not found' }, { status: 401 });
    }

    let welcomeEmailSent = false;
    if (!profile.must_set_password) {
      const welcome = await sendWelcomeSignInEmailOnce(profile.id);
      welcomeEmailSent = welcome.sent;
      if (!welcome.sent && !welcome.skipped) {
        console.error('Welcome email on login failed:', welcome.reason);
      }
    }

    const response = NextResponse.json({
      user: profile,
      session: authData.session,
      must_set_password: Boolean(profile.must_set_password),
      welcome_email_sent: welcomeEmailSent,
    });
    copyResponseCookies(authResponse, response);
    attachAppSessionCookie(response, profile.id);
    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

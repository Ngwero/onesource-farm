import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { setDevSessionCookie } from '@/lib/auth/session';
import { sendWelcomeSignInEmailOnce } from '@/lib/notifications/email';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const email = String(payload?.email || '').trim().toLowerCase();
    const password = String(payload?.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const profileClient = createServiceClient();
      const { data: user } = await profileClient
        .from('users')
        .select('*, roles(slug, name), departments(name, code)')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      await setDevSessionCookie(user.id);

      return NextResponse.json({
        user,
        must_set_password: Boolean(user.must_set_password),
        message: 'Dev session only — configure Supabase Auth for production',
      });
    }

    const profileClient = createServiceClient();
    const { data: profile } = await profileClient
      .from('users')
      .select('*, roles(slug, name), departments(name, code)')
      .eq('id', authData.user.id)
      .single();

    let welcomeEmailSent = false;
    if (profile && !profile.must_set_password) {
      const welcome = await sendWelcomeSignInEmailOnce(profile.id);
      welcomeEmailSent = welcome.sent;
      if (!welcome.sent && !welcome.skipped) {
        console.error('Welcome email on login failed:', welcome.reason);
      }
    }

    return NextResponse.json({
      user: profile,
      session: authData.session,
      must_set_password: Boolean(profile?.must_set_password),
      welcome_email_sent: welcomeEmailSent,
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

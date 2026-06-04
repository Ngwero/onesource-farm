import { NextRequest, NextResponse } from 'next/server';
import { authCallbackUrl, resolveAppUrl } from '@/lib/auth/appUrl';
import { createAuthVerifyClient } from '@/lib/supabase/authVerify';
import { createServiceClient } from '@/lib/supabase/server';

function mapResetError(message: string, redirectTo: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('redirect') || lower.includes('allow')) {
    return (
      'Password reset is not configured for this site URL. Ask IT to add this URL in Supabase → Authentication → Redirect URLs: ' +
      redirectTo
    );
  }
  if (lower.includes('rate') || lower.includes('limit')) {
    return 'Too many reset attempts. Please wait a few minutes and try again.';
  }
  return 'Could not send reset email. Check the address or contact IT.';
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const redirectTo = authCallbackUrl(request);
    const appUrl = resolveAppUrl(request);

    const admin = createServiceClient();
    const { data: profile } = await admin
      .from('users')
      .select('id, is_active')
      .eq('email', normalized)
      .maybeSingle();

    if (!profile?.id || !profile.is_active) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a password reset link has been sent.',
      });
    }

    const supabase = createAuthVerifyClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo,
    });

    if (error) {
      console.error('Forgot password error:', {
        message: error.message,
        status: error.status,
        email: normalized,
        redirectTo,
        appUrl,
      });
      return NextResponse.json(
        {
          error: mapResetError(error.message, redirectTo),
          ...(process.env.NODE_ENV === 'development'
            ? { detail: error.message, redirectTo }
            : {}),
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists, a password reset link has been sent.',
    });
  } catch (err) {
    console.error('Forgot password exception:', err);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

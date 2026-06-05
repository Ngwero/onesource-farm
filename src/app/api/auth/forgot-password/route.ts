import { NextRequest, NextResponse } from 'next/server';
import { authCallbackUrl, resolveAppUrl } from '@/lib/auth/appUrl';
import {
  getSupabaseUrlMisconfigMessage,
  isValidSupabaseProjectUrl,
} from '@/lib/supabase/config';
import { sendPasswordResetEmail } from '@/lib/notifications/email';
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

    if (!isValidSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      console.error('Forgot password: invalid Supabase URL', {
        configured: process.env.NEXT_PUBLIC_SUPABASE_URL,
        appUrl: resolveAppUrl(request),
      });
      return NextResponse.json(
        { error: 'Server misconfiguration. Contact IT to fix Supabase URL in deployment settings.' },
        { status: 503 }
      );
    }

    const redirectTo = authCallbackUrl(request);
    const appUrl = resolveAppUrl(request);

    const admin = createServiceClient();
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('id, full_name, is_active')
      .eq('email', normalized)
      .maybeSingle();

    if (profileError) {
      console.error('Forgot password: profile lookup failed', {
        message: profileError.message,
        code: profileError.code,
        email: normalized,
        hint: getSupabaseUrlMisconfigMessage(),
      });
      return NextResponse.json(
        { error: 'Could not verify account. Contact IT — database connection may be misconfigured.' },
        { status: 503 }
      );
    }

    if (!profile?.id || !profile.is_active) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a password reset link has been sent.',
      });
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: normalized,
      options: { redirectTo },
    });

    const resetUrl = linkData?.properties?.action_link;

    if (linkError || !resetUrl) {
      console.error('Forgot password: generateLink failed', {
        message: linkError?.message,
        email: normalized,
        redirectTo,
        appUrl,
      });
      return NextResponse.json(
        {
          error: mapResetError(linkError?.message || 'missing link', redirectTo),
          ...(process.env.NODE_ENV === 'development'
            ? { detail: linkError?.message, redirectTo }
            : {}),
        },
        { status: 400 }
      );
    }

    const emailResult = await sendPasswordResetEmail({
      email: normalized,
      fullName: profile.full_name || 'Colleague',
      resetUrl,
      appUrl,
    });

    if (!emailResult.sent) {
      console.error('Forgot password: branded email failed', {
        email: normalized,
        reason: emailResult.reason,
      });
      return NextResponse.json(
        {
          error:
            emailResult.reason === 'smtp_not_configured'
              ? 'Email is not configured on the server. Contact IT to set up SMTP for password resets.'
              : 'Could not send reset email. Try again later or contact IT.',
        },
        { status: 503 }
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

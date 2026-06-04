import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
      /\/$/,
      ''
    );
    const supabase = await createClient();
    const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`;

    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo,
    });

    if (error) {
      console.error('Forgot password error:', error);
      return NextResponse.json(
        { error: 'Could not send reset email. Check the address or contact IT.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists, a password reset link has been sent.',
    });
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabase/routeHandler';

const EXPIRED_MSG = 'Reset link expired or invalid. Request a new one.';

/**
 * Handles password recovery links. Server-generated resets use token_hash + verifyOtp
 * (PKCE code exchange does not work for admin.generateLink emails).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/auth/reset-password';

  if (!code && !token_hash) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = createRouteHandlerClient(request, response);

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      console.error('Auth callback verifyOtp error:', error.message);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(EXPIRED_MSG)}`);
    }
    return response;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Auth callback exchangeCodeForSession error:', error.message);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(EXPIRED_MSG)}`);
    }
    return response;
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(EXPIRED_MSG)}`);
}

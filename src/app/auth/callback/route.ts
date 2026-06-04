import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Handles Supabase email links (password recovery, etc.) and exchanges ?code= for a session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/auth/reset-password';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Auth callback error:', error.message);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Reset link expired or invalid. Request a new one.')}`
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

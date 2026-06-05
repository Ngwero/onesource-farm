import { NextRequest, NextResponse } from 'next/server';
import { clearAppSessionCookie } from '@/lib/auth/session';
import { createRouteHandlerClient } from '@/lib/supabase/routeHandler';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  try {
    const supabase = createRouteHandlerClient(request, response);
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  clearAppSessionCookie(response);
  return response;
}

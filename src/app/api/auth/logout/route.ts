import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clearDevSessionCookie } from '@/lib/auth/session';

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    await clearDevSessionCookie();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}

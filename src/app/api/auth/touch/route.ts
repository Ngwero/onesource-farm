import { NextResponse } from 'next/server';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';

/** Keep the server inactivity window alive while the user is active in the browser. */
export async function POST() {
  try {
    await requireAuth({ allowMustSetPassword: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}

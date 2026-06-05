import { NextResponse } from 'next/server';
import { attachAppSessionCookie, getAuthUser, authErrorResponse } from '@/lib/auth/session';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = NextResponse.json({ user });
    attachAppSessionCookie(response, user.id);
    return response;
  } catch (err) {
    return authErrorResponse(err);
  }
}

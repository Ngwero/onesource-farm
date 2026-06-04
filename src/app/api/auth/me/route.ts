import { NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse } from '@/lib/auth/session';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (err) {
    return authErrorResponse(err);
  }
}

import { NextRequest, NextResponse } from 'next/server';

/** Accept the Vercel cron bearer token. Secrets must not appear in URLs. */
export function authorizeCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 401 });
  }

  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return null;

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

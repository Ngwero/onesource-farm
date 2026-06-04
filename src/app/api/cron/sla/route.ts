import { NextRequest, NextResponse } from 'next/server';
import { processSlaChecks } from '@/lib/sla/service';

/** Protected cron endpoint — set CRON_SECRET in env and pass ?secret=... */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const provided = searchParams.get('secret');

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processSlaChecks();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

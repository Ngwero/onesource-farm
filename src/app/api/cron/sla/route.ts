import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/cron/auth';
import { processSlaChecks } from '@/lib/sla/service';

/** Protected cron — Authorization: Bearer CRON_SECRET */
export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const result = await processSlaChecks();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

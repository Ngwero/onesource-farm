import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/cron/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { processFarmReportDigests } from '@/lib/farm/digests';

/** Protected cron — Authorization: Bearer CRON_SECRET */
export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const supabase = createServiceClient();
  const result = await processFarmReportDigests(supabase);
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

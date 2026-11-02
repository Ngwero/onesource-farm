import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { loadPackingSources } from '@/lib/farm/packhouse';

/** Graded harvest batches with produce still to pack, for the packing form. */
export async function GET() {
  return withPermission('packing.record', async () => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    return NextResponse.json({ sources: await loadPackingSources(supabase, farmId) });
  });
}

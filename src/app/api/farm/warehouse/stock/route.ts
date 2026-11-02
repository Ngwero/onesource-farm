import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { loadPackingBatches } from '@/lib/farm/packhouse';

/** Packed batches with ledger balances: received stock plus batches awaiting receipt. */
export async function GET(request: Request) {
  return withPermission('warehouse.view', async () => {
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const view = url.searchParams.get('view');
    const batches = await loadPackingBatches(supabase, farmId, {
      locationId: url.searchParams.get('location_id') ?? undefined,
      received: view === 'awaiting' ? false : view === 'all' ? undefined : true,
    });
    return NextResponse.json({ batches });
  });
}

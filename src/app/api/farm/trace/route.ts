import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { HttpError } from '@/lib/farm/http';
import { findTraceTarget, harvestIdForPacking, loadTrace } from '@/lib/farm/packhouse';

/**
 * ?harvest_batch_id= or ?packing_batch_id= returns the full chain for that batch.
 * ?q= resolves a harvest or packing number; an exact match returns the chain, otherwise suggestions.
 */
export async function GET(request: Request) {
  return withPermission('traceability.view', async ({ can }) => {
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const harvestId = url.searchParams.get('harvest_batch_id');
    const packingId = url.searchParams.get('packing_batch_id');
    const q = url.searchParams.get('q')?.trim();

    if (harvestId) {
      return NextResponse.json({ trace: await loadTrace(supabase, farmId, harvestId, { type: 'harvest_batch', id: harvestId }, can) });
    }
    if (packingId) {
      const harvest = await harvestIdForPacking(supabase, farmId, packingId);
      return NextResponse.json({ trace: await loadTrace(supabase, farmId, harvest, { type: 'packing_batch', id: packingId }, can) });
    }
    if (!q) throw new HttpError('Enter a harvest batch or packed batch number.', 400);

    const { exact, matches } = await findTraceTarget(supabase, farmId, q);
    if (!exact) return NextResponse.json({ trace: null, matches });
    const harvest = exact.type === 'packing_batch' ? await harvestIdForPacking(supabase, farmId, exact.id) : exact.id;
    return NextResponse.json({
      trace: await loadTrace(supabase, farmId, harvest, { type: exact.type, id: exact.id }, can),
      matches,
    });
  });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { harvestRpcArgs, loadHarvestBatch, normalizeBatches } from '@/lib/farm/operations';
import { HARVEST_SELECT } from '@/lib/farm/queries';
import { harvestBatchSchema } from '@/lib/farm/schemas';

export async function GET(request: Request) {
  return withPermission('harvest.view', async () => {
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    let query = supabase.from('harvest_batches').select(HARVEST_SELECT).eq('farm_id', farmId);
    const status = url.searchParams.get('status');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const blockId = url.searchParams.get('block_id');
    const cycleId = url.searchParams.get('planting_cycle_id');
    if (status === 'pending_grading' || status === 'graded') query = query.eq('status', status);
    if (from) query = query.gte('harvest_date', from);
    if (to) query = query.lte('harvest_date', to);
    if (blockId) query = query.eq('block_id', blockId);
    if (cycleId) query = query.eq('planting_cycle_id', cycleId);
    const { data, error } = await query
      .order('harvest_date', { ascending: false })
      .order('batch_no', { ascending: false })
      .limit(500);
    if (error) throw error;
    const batches = await normalizeBatches(supabase, (data ?? []) as never);
    return NextResponse.json({ batches });
  });
}

export async function POST(request: Request) {
  return withPermission('harvest.record', async ({ user }) => {
    const input = await parseBody(request, harvestBatchSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data: id, error } = await supabase.rpc('farm_save_harvest_batch', harvestRpcArgs(null, farmId, user.id, input));
    if (error) throw error;
    const batch = await loadHarvestBatch(supabase, farmId, id as string);
    await auditFarm(user.id, 'created', 'harvest_batch', batch.id, { new: { ...input, batch_no: batch.batch_no } });
    return NextResponse.json({ batch }, { status: 201 });
  });
}

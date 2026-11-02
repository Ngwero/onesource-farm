import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { loadPackingBatch, loadPackingBatches } from '@/lib/farm/packhouse';
import { packingBatchSchema, QC_STATUSES } from '@/lib/farm/schemas';

export async function GET(request: Request) {
  return withPermission('packing.view', async () => {
    const url = new URL(request.url);
    const qcStatus = url.searchParams.get('qc_status');
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const batches = await loadPackingBatches(supabase, farmId, {
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      harvestId: url.searchParams.get('harvest_batch_id') ?? undefined,
      qcStatus: qcStatus && (QC_STATUSES as readonly string[]).includes(qcStatus) ? qcStatus : undefined,
    });
    return NextResponse.json({ batches });
  });
}

export async function POST(request: Request) {
  return withPermission('packing.record', async ({ user }) => {
    const input = await parseBody(request, packingBatchSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data: id, error } = await supabase.rpc('farm_save_packing_batch', {
      p_id: null,
      p_farm: farmId,
      p_user: user.id,
      p_data: input,
    });
    if (error) throw error;
    const batch = await loadPackingBatch(supabase, farmId, id as string);
    await auditFarm(user.id, 'created', 'packing_batch', batch.id, { new: { ...input, packing_no: batch.packing_no } });
    return NextResponse.json({ batch }, { status: 201 });
  });
}

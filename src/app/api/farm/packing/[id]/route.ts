import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { deleteAttachmentsFor } from '@/lib/farm/operations';
import { loadPackingBatch } from '@/lib/farm/packhouse';
import { packingBatchSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission(undefined, async ({ can }) => {
    if (!can('packing.view') && !can('warehouse.view') && !can('qc.view')) {
      throw new HttpError('You do not have permission to view packed batches.', 403);
    }
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    return NextResponse.json({ batch: await loadPackingBatch(supabase, farmId, id) });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('packing.record', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, packingBatchSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { error } = await supabase.rpc('farm_save_packing_batch', { p_id: id, p_farm: farmId, p_user: user.id, p_data: input });
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'packing_batch', id, { new: input });
    return NextResponse.json({ batch: await loadPackingBatch(supabase, farmId, id) });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('packing.record', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const batch = await loadPackingBatch(supabase, farmId, id);
    if (batch.received_date || batch.inspections.length) {
      throw new HttpError('This batch has been received into the warehouse or inspected, so it cannot be deleted.', 409);
    }
    const { error } = await supabase.from('packing_batches').delete().eq('id', id).eq('farm_id', farmId);
    if (error) throw error;
    await deleteAttachmentsFor(supabase, 'packing_batch', id);
    await auditFarm(user.id, 'deleted', 'packing_batch', id, {
      old: { packing_no: batch.packing_no, package_count: batch.package_count, net_weight: batch.net_weight },
    });
    return NextResponse.json({ ok: true });
  });
}

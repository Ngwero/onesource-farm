import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { deleteAttachmentsFor, harvestRpcArgs, loadHarvestBatch } from '@/lib/farm/operations';
import { harvestBatchSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission('harvest.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    return NextResponse.json({ batch: await loadHarvestBatch(supabase, farmId, id) });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('harvest.record', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, harvestBatchSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { error } = await supabase.rpc('farm_save_harvest_batch', harvestRpcArgs(id, farmId, user.id, input));
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'harvest_batch', id, { new: input });
    return NextResponse.json({ batch: await loadHarvestBatch(supabase, farmId, id) });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('harvest.record', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const batch = await loadHarvestBatch(supabase, farmId, id);
    if (batch.grading) {
      throw new HttpError('This batch has been graded. Delete the grading first if the batch was recorded by mistake.', 409);
    }
    const { error } = await supabase.from('harvest_batches').delete().eq('id', id).eq('farm_id', farmId);
    if (error) throw error;
    await deleteAttachmentsFor(supabase, 'harvest_batch', id);
    await auditFarm(user.id, 'deleted', 'harvest_batch', id, {
      old: { batch_no: batch.batch_no, quantity: batch.quantity, harvest_date: batch.harvest_date },
    });
    return NextResponse.json({ ok: true });
  });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { deleteAttachmentsFor } from '@/lib/farm/operations';
import { loadInspection, qcRpcArgs } from '@/lib/farm/packhouse';
import { qcInspectionSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission('qc.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    return NextResponse.json({ inspection: await loadInspection(supabase, farmId, id) });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('qc.inspect', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, qcInspectionSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { error } = await supabase.rpc('farm_save_qc_inspection', qcRpcArgs(id, farmId, user.id, input));
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'qc_inspection', id, { new: input });
    return NextResponse.json({ inspection: await loadInspection(supabase, farmId, id) });
  });
}

/** Only inspections still awaiting review can be deleted; reviewed ones are part of the QC record. */
export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('qc.inspect', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const inspection = await loadInspection(supabase, farmId, id);
    if (inspection.review_status !== 'awaiting_review') {
      throw new HttpError('Reviewed inspections are kept as part of the QC record and cannot be deleted.', 409);
    }
    const { error } = await supabase
      .from('qc_inspections')
      .delete()
      .eq('id', id)
      .eq('farm_id', farmId)
      .eq('review_status', 'awaiting_review');
    if (error) throw error;
    const { error: syncError } = await supabase.rpc('farm_sync_qc_status', {
      p_harvest: inspection.harvest_batch_id,
      p_packing: inspection.packing_batch_id,
    });
    if (syncError) throw syncError;
    await deleteAttachmentsFor(supabase, 'qc_inspection', id);
    await auditFarm(user.id, 'deleted', 'qc_inspection', id, {
      old: { inspection_no: inspection.inspection_no, result: inspection.result },
    });
    return NextResponse.json({ ok: true });
  });
}

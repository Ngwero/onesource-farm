import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { loadHarvestBatch } from '@/lib/farm/operations';
import { gradingSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

/** Create or replace the batch's grading; the database enforces that grades add up to the harvest. */
export async function PUT(request: Request, { params }: Params) {
  return withPermission('grading.record', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, gradingSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const before = await loadHarvestBatch(supabase, farmId, id);
    const { lines, rejections, ...data } = input;
    const { error } = await supabase.rpc('farm_save_grading', {
      p_batch: id,
      p_farm: farmId,
      p_user: user.id,
      p_data: data,
      p_lines: lines,
      p_rejections: rejections,
    });
    if (error) {
      if (error.code === '23503') {
        throw new HttpError('One of the grades is not enabled for this crop. Check the crop’s grading setup.', 400);
      }
      throw error;
    }
    const batch = await loadHarvestBatch(supabase, farmId, id);
    await auditFarm(user.id, before.grading ? 'updated' : 'created', 'harvest_grading', batch.grading!.id, {
      old: before.grading ? { lines: before.grading.lines } : undefined,
      new: input,
    });
    return NextResponse.json({ batch });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('grading.record', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('harvest_gradings')
      .delete()
      .eq('batch_id', id)
      .eq('farm_id', farmId)
      .select('id, total_quantity, graded_date')
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'deleted', 'harvest_grading', data.id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { cropForCycle, taskRow } from '@/lib/farm/operations';
import { TASK_SELECT } from '@/lib/farm/queries';
import { taskSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

/** Managers edit tasks; supervisors who record activities may update progress on them. */
export async function PATCH(request: Request, { params }: Params) {
  return withPermission(undefined, async ({ user, can }) => {
    if (!can('workforce.manage') && !can('activities.record')) {
      throw new HttpError('You do not have permission to update tasks.', 403);
    }
    const { id } = await params;
    const input = await parseBody(request, taskSchema);
    if (input.worker_ids.length !== 1) {
      throw new HttpError('A task belongs to exactly one worker.', 400, { worker_ids: 'Select one worker' });
    }
    if (input.planting_cycle_id && !input.block_id) {
      throw new HttpError('Choose the block for this planting.', 400, { block_id: 'Required with a planting' });
    }
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const cropId = input.block_id ? await cropForCycle(supabase, farmId, input.block_id, input.planting_cycle_id) : null;
    const { data, error } = await supabase
      .from('worker_tasks')
      .update({ ...taskRow(input, cropId), worker_id: input.worker_ids[0] })
      .eq('id', id)
      .eq('farm_id', farmId)
      .select(TASK_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'worker_task', id, { new: input });
    return NextResponse.json({ task: data });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('workforce.manage', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('worker_tasks')
      .delete()
      .eq('id', id)
      .eq('farm_id', farmId)
      .select('id, worker_id, activity_type_id, start_at')
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'deleted', 'worker_task', id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

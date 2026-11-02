import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { cropForCycle, taskRow } from '@/lib/farm/operations';
import { TASK_SELECT } from '@/lib/farm/queries';
import { TASK_STATUSES, taskSchema } from '@/lib/farm/schemas';

export async function GET(request: Request) {
  return withPermission('workforce.view', async () => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    let query = supabase.from('worker_tasks').select(TASK_SELECT).eq('farm_id', farmId);
    if (status === 'open') query = query.in('status', ['assigned', 'in_progress']);
    else if (status && (TASK_STATUSES as readonly string[]).includes(status)) query = query.eq('status', status);
    const { data, error } = await query.order('start_at', { ascending: false }).limit(500);
    if (error) throw error;
    return NextResponse.json({ tasks: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission('workforce.manage', async ({ user }) => {
    const input = await parseBody(request, taskSchema);
    if (input.planting_cycle_id && !input.block_id) {
      throw new HttpError('Choose the block for this planting.', 400, { block_id: 'Required with a planting' });
    }
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const cropId = input.block_id ? await cropForCycle(supabase, farmId, input.block_id, input.planting_cycle_id) : null;
    const base = taskRow(input, cropId);
    const { data, error } = await supabase
      .from('worker_tasks')
      .insert(input.worker_ids.map((worker_id) => ({ ...base, worker_id, farm_id: farmId, created_by: user.id })))
      .select('id');
    if (error) throw error;
    for (const t of data ?? []) await auditFarm(user.id, 'created', 'worker_task', t.id, { new: base });
    return NextResponse.json({ created: data?.length ?? 0 }, { status: 201 });
  });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { deleteAttachmentsFor, withHourlyRates } from '@/lib/farm/operations';
import { TASK_SELECT, WORKER_SELECT } from '@/lib/farm/queries';
import { workerSchema } from '@/lib/farm/schemas';
import type { WorkerRow } from '@/lib/farm/types';

type Params = { params: Promise<{ id: string }> };

/** Worker profile with recent attendance, tasks and the labour they have been costed to. */
export async function GET(_request: Request, { params }: Params) {
  return withPermission('workforce.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

    const [workerRes, attendanceRes, tasksRes, activityRes, harvestRes] = await Promise.all([
      supabase.from('workers').select(WORKER_SELECT).eq('id', id).eq('farm_id', farmId).single(),
      supabase
        .from('worker_attendance')
        .select('attendance_date, status, hours_worked, overtime_hours, notes')
        .eq('worker_id', id)
        .gte('attendance_date', since)
        .order('attendance_date', { ascending: false }),
      supabase.from('worker_tasks').select(TASK_SELECT).eq('worker_id', id).order('start_at', { ascending: false }).limit(25),
      supabase
        .from('farm_activity_workers')
        .select(
          'hours_worked, cost, activity:farm_activities!inner(id, activity_date, block:blocks!farm_activities_block_id_farm_id_fkey(code), activity_type:activity_types!farm_activities_activity_type_id_fkey(name))'
        )
        .eq('worker_id', id)
        .gte('activity.activity_date', since)
        .order('activity_date', { referencedTable: 'activity', ascending: false })
        .limit(50),
      supabase
        .from('harvest_batch_workers')
        .select(
          'hours_worked, cost, quantity_picked, batch:harvest_batches!inner(id, batch_no, harvest_date, unit)'
        )
        .eq('worker_id', id)
        .gte('batch.harvest_date', since)
        .limit(50),
    ]);
    if (workerRes.error) throw workerRes.error;
    for (const r of [attendanceRes, tasksRes, activityRes, harvestRes]) if (r.error) throw r.error;

    const [worker] = await withHourlyRates(supabase, [workerRes.data as unknown as WorkerRow]);
    return NextResponse.json({
      worker,
      attendance: attendanceRes.data ?? [],
      tasks: tasksRes.data ?? [],
      activityLabour: activityRes.data ?? [],
      harvestLabour: harvestRes.data ?? [],
    });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('workforce.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, workerSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('workers')
      .update({
        ...input,
        daily_rate: input.pay_basis === 'daily' ? input.daily_rate : null,
        monthly_salary: input.pay_basis === 'monthly' ? input.monthly_salary : null,
      })
      .eq('id', id)
      .eq('farm_id', farmId)
      .select(WORKER_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'worker', id, { new: input });
    const [worker] = await withHourlyRates(supabase, [data as unknown as WorkerRow]);
    return NextResponse.json({ worker });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('workforce.manage', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('workers')
      .delete()
      .eq('id', id)
      .eq('farm_id', farmId)
      .select('id, worker_code, full_name')
      .single();
    if (error) throw error;
    await deleteAttachmentsFor(supabase, 'worker', id);
    await auditFarm(user.id, 'deleted', 'worker', id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

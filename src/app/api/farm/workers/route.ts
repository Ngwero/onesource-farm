import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { withHourlyRates } from '@/lib/farm/operations';
import { WORKER_SELECT } from '@/lib/farm/queries';
import { workerSchema } from '@/lib/farm/schemas';
import type { WorkerRow } from '@/lib/farm/types';

export async function GET() {
  return withPermission('workforce.view', async () => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('workers')
      .select(WORKER_SELECT)
      .eq('farm_id', farmId)
      .order('worker_code');
    if (error) throw error;
    const workers = await withHourlyRates(supabase, (data ?? []) as unknown as WorkerRow[]);
    return NextResponse.json({ workers });
  });
}

export async function POST(request: Request) {
  return withPermission('workforce.manage', async ({ user }) => {
    const input = await parseBody(request, workerSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('workers')
      .insert({
        ...input,
        daily_rate: input.pay_basis === 'daily' ? input.daily_rate : null,
        monthly_salary: input.pay_basis === 'monthly' ? input.monthly_salary : null,
        farm_id: farmId,
        created_by: user.id,
      })
      .select(WORKER_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'created', 'worker', data.id, { new: input });
    const [worker] = await withHourlyRates(supabase, [data as unknown as WorkerRow]);
    return NextResponse.json({ worker }, { status: 201 });
  });
}

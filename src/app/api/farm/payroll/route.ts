import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { payrollPeriodSchema } from '@/lib/farm/schemas';

export async function GET() {
  return withPermission('payroll.view', async () => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('payroll_periods')
      .select('*, lines:payroll_lines(amount_payable, payment_status)')
      .eq('farm_id', farmId)
      .order('period_start', { ascending: false });
    if (error) throw error;
    const periods = (data ?? []).map(({ lines, ...p }) => {
      const rows = lines as { amount_payable: number; payment_status: string }[];
      return {
        ...p,
        line_count: rows.length,
        total_payable: rows.reduce((s, l) => s + Number(l.amount_payable), 0),
        total_paid: rows.filter((l) => l.payment_status === 'paid').reduce((s, l) => s + Number(l.amount_payable), 0),
      };
    });
    return NextResponse.json({ periods });
  });
}

export async function POST(request: Request) {
  return withPermission('payroll.manage', async ({ user }) => {
    const input = await parseBody(request, payrollPeriodSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const { data: overlap, error: overlapError } = await supabase
      .from('payroll_periods')
      .select('name')
      .eq('farm_id', farmId)
      .lte('period_start', input.period_end)
      .gte('period_end', input.period_start)
      .limit(1);
    if (overlapError) throw overlapError;
    if (overlap?.length) {
      throw new HttpError(`These dates overlap the existing period "${overlap[0].name}".`, 409, {
        period_start: 'Overlaps another period',
      });
    }

    const { data, error } = await supabase
      .from('payroll_periods')
      .insert({ ...input, farm_id: farmId, created_by: user.id })
      .select('id')
      .single();
    if (error) throw error;
    const { error: genError } = await supabase.rpc('farm_generate_payroll', { p_period: data.id });
    if (genError) throw genError;
    await auditFarm(user.id, 'created', 'payroll_period', data.id, { new: input });
    return NextResponse.json({ id: data.id }, { status: 201 });
  });
}

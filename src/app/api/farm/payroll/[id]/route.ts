import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { labourAllocation } from '@/lib/farm/operations';

type Params = { params: Promise<{ id: string }> };

const actionSchema = z.object({ action: z.enum(['recalculate', 'finalize', 'reopen']) });

async function loadPeriod(id: string, farmId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('payroll_periods').select('*').eq('id', id).eq('farm_id', farmId).single();
  if (error) throw error;
  return data;
}

export async function GET(_request: Request, { params }: Params) {
  return withPermission('payroll.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const period = await loadPeriod(id, farmId);
    const [linesRes, allocation] = await Promise.all([
      supabase
        .from('payroll_lines')
        .select('*, worker:workers(id, worker_code, full_name, category)')
        .eq('period_id', id),
      labourAllocation(supabase, farmId, period.period_start, period.period_end),
    ]);
    if (linesRes.error) throw linesRes.error;
    const lines = (linesRes.data ?? []).sort((a, b) =>
      String(a.worker?.worker_code ?? '').localeCompare(String(b.worker?.worker_code ?? ''))
    );
    return NextResponse.json({ period, lines, allocation });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('payroll.manage', async ({ user }) => {
    const { id } = await params;
    const { action } = await parseBody(request, actionSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const period = await loadPeriod(id, farmId);

    if (action === 'recalculate') {
      const { error } = await supabase.rpc('farm_generate_payroll', { p_period: id });
      if (error) throw error;
    } else if (action === 'finalize') {
      if (period.status !== 'draft') throw new HttpError('Only draft periods can be finalized.', 400);
      const { count, error: countError } = await supabase
        .from('payroll_lines')
        .select('id', { count: 'exact', head: true })
        .eq('period_id', id);
      if (countError) throw countError;
      if (!count) throw new HttpError('There are no payroll lines to finalize. Record attendance, then recalculate.', 400);
      const { error } = await supabase
        .from('payroll_periods')
        .update({ status: 'finalized', finalized_at: new Date().toISOString(), finalized_by: user.id })
        .eq('id', id);
      if (error) throw error;
    } else {
      if (period.status !== 'finalized') throw new HttpError('Only finalized periods can be reopened.', 400);
      const { count, error: paidError } = await supabase
        .from('payroll_lines')
        .select('id', { count: 'exact', head: true })
        .eq('period_id', id)
        .eq('payment_status', 'paid');
      if (paidError) throw paidError;
      if (count) throw new HttpError('Some workers in this period have been paid. Mark them unpaid before reopening.', 400);
      const { error } = await supabase
        .from('payroll_periods')
        .update({ status: 'draft', finalized_at: null, finalized_by: null })
        .eq('id', id);
      if (error) throw error;
    }
    await auditFarm(user.id, 'updated', 'payroll_period', id, { old: { status: period.status }, new: { action } });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('payroll.manage', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const period = await loadPeriod(id, farmId);
    if (period.status !== 'draft') throw new HttpError('Only draft periods can be deleted. Reopen it first.', 400);
    const { error } = await supabase.from('payroll_periods').delete().eq('id', id);
    if (error) throw error;
    await auditFarm(user.id, 'deleted', 'payroll_period', id, { old: period });
    return NextResponse.json({ ok: true });
  });
}

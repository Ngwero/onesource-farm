import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { payrollPaymentSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

/** Mark payroll lines paid or unpaid; the period becomes "paid" once every line is paid. */
export async function PUT(request: Request, { params }: Params) {
  return withPermission('payroll.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, payrollPaymentSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('id, status')
      .eq('id', id)
      .eq('farm_id', farmId)
      .single();
    if (periodError) throw periodError;
    if (period.status === 'draft') throw new HttpError('Finalize the period before recording payments.', 400);
    if (input.paid && !input.paid_at) throw new HttpError('Enter the payment date.', 400, { paid_at: 'Required' });

    const { error } = await supabase
      .from('payroll_lines')
      .update(
        input.paid
          ? { payment_status: 'paid', paid_at: input.paid_at, payment_reference: input.payment_reference ?? null }
          : { payment_status: 'unpaid', paid_at: null, payment_reference: null }
      )
      .eq('period_id', id)
      .in('id', input.line_ids);
    if (error) throw error;

    const { count: unpaid, error: countError } = await supabase
      .from('payroll_lines')
      .select('id', { count: 'exact', head: true })
      .eq('period_id', id)
      .eq('payment_status', 'unpaid');
    if (countError) throw countError;
    const status = unpaid ? 'finalized' : 'paid';
    if (status !== period.status) {
      const { error: statusError } = await supabase.from('payroll_periods').update({ status }).eq('id', id);
      if (statusError) throw statusError;
    }

    await auditFarm(user.id, 'updated', 'payroll_payment', id, { new: input });
    return NextResponse.json({ status });
  });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { payrollLineSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

/** Advances and deductions on a draft line (the database rejects changes once finalized). */
export async function PATCH(request: Request, { params }: Params) {
  return withPermission('payroll.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, payrollLineSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { error: ownerError } = await supabase
      .from('payroll_lines')
      .select('id, period:payroll_periods!inner(farm_id)')
      .eq('id', id)
      .eq('period.farm_id', farmId)
      .single();
    if (ownerError) throw ownerError;
    const { data, error } = await supabase.from('payroll_lines').update(input).eq('id', id).select('*').single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'payroll_line', id, { new: input });
    return NextResponse.json({ line: data });
  });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { loadInspection } from '@/lib/farm/packhouse';
import { qcReworkSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

/** Record that rework or re-sorting was done; the batch then needs reinspection. */
export async function POST(request: Request, { params }: Params) {
  return withPermission('qc.inspect', async ({ user }) => {
    const { id } = await params;
    const { notes } = await parseBody(request, qcReworkSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { error } = await supabase.rpc('farm_complete_qc_rework', { p_id: id, p_farm: farmId, p_user: user.id, p_notes: notes });
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'qc_inspection', id, { new: { rework_notes: notes } });
    return NextResponse.json({ inspection: await loadInspection(supabase, farmId, id) });
  });
}

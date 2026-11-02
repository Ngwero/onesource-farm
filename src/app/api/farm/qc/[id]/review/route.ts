import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { loadInspection } from '@/lib/farm/packhouse';
import { qcReviewSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

/** Supervisor decision: approve, send for rework, require reinspection, or reject. */
export async function POST(request: Request, { params }: Params) {
  return withPermission('qc.approve', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, qcReviewSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { error } = await supabase.rpc('farm_review_qc_inspection', {
      p_id: id,
      p_farm: farmId,
      p_user: user.id,
      p_decision: input.decision,
      p_notes: input.notes ?? null,
    });
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'qc_inspection', id, { new: { review_status: input.decision, review_notes: input.notes } });
    return NextResponse.json({ inspection: await loadInspection(supabase, farmId, id) });
  });
}

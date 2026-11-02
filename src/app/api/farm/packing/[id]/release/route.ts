import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { loadPackingBatch } from '@/lib/farm/packhouse';
import { exportReleaseSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

/** Final export release of a QC-approved packed batch, or withdrawal of a release before dispatch. */
export async function POST(request: Request, { params }: Params) {
  return withPermission('qc.release', async ({ user }) => {
    const { id } = await params;
    const { release } = await parseBody(request, exportReleaseSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { error } = await supabase.rpc('farm_set_export_release', {
      p_batch: id,
      p_farm: farmId,
      p_user: user.id,
      p_release: release,
    });
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'packing_batch', id, {
      new: { qc_status: release ? 'released' : 'approved', export_release: release ? 'released' : 'withdrawn' },
    });
    return NextResponse.json({ batch: await loadPackingBatch(supabase, farmId, id) });
  });
}

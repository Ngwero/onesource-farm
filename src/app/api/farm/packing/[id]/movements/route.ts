import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { loadPackingBatch } from '@/lib/farm/packhouse';
import { stockMovementSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

/** Receive, move, write off or dispatch stock of a packed batch; the database checks balances. */
export async function POST(request: Request, { params }: Params) {
  return withPermission('warehouse.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, stockMovementSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data: movementId, error } = await supabase.rpc('farm_record_stock_movement', {
      p_batch: id,
      p_farm: farmId,
      p_user: user.id,
      p_data: input,
    });
    if (error) throw error;
    await auditFarm(user.id, 'created', 'stock_movement', movementId as string, { new: { packing_batch_id: id, ...input } });
    return NextResponse.json({ batch: await loadPackingBatch(supabase, farmId, id) }, { status: 201 });
  });
}

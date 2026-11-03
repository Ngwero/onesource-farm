import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { INPUT_LOT_SELECT } from '@/lib/farm/queries';
import { inputLotSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission('procurement.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('input_lots')
      .select(INPUT_LOT_SELECT)
      .eq('id', id)
      .eq('farm_id', farmId)
      .single();
    if (error) throw error;
    return NextResponse.json({ lot: data });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('procurement.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, inputLotSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const { data: product, error: productError } = await supabase
      .from('input_products')
      .select('id')
      .eq('id', input.product_id)
      .eq('farm_id', farmId)
      .maybeSingle();
    if (productError) throw productError;
    if (!product) throw new HttpError('Product not found on this farm.', 400, { product_id: 'Not found' });

    const { data, error } = await supabase
      .from('input_lots')
      .update(input)
      .eq('id', id)
      .eq('farm_id', farmId)
      .select(INPUT_LOT_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'input_lot', id, { new: input });
    return NextResponse.json({ lot: data });
  });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { INPUT_PRODUCT_SELECT } from '@/lib/farm/queries';
import { inputProductSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission('procurement.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('input_products')
      .select(INPUT_PRODUCT_SELECT)
      .eq('id', id)
      .eq('farm_id', farmId)
      .single();
    if (error) throw error;
    return NextResponse.json({ product: data });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('procurement.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, inputProductSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('input_products')
      .update(input)
      .eq('id', id)
      .eq('farm_id', farmId)
      .select(INPUT_PRODUCT_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'input_product', id, { new: input });
    return NextResponse.json({ product: data });
  });
}

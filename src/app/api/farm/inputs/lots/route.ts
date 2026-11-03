import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { INPUT_LOT_SELECT } from '@/lib/farm/queries';
import { inputLotSchema } from '@/lib/farm/schemas';

export async function GET(request: Request) {
  return withPermission(undefined, async ({ can }) => {
    if (!can('procurement.view') && !can('activities.record') && !can('activities.view')) {
      throw new HttpError('You do not have permission to view input lots.', 403);
    }
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    let query = supabase.from('input_lots').select(INPUT_LOT_SELECT).eq('farm_id', farmId);
    const productId = url.searchParams.get('product_id');
    if (productId) query = query.eq('product_id', productId);
    if (url.searchParams.get('in_stock') === '1') query = query.gt('quantity_remaining', 0);
    const { data, error } = await query
      .order('received_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ lots: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission('procurement.manage', async ({ user }) => {
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
      .insert({ ...input, farm_id: farmId, created_by: user.id })
      .select(INPUT_LOT_SELECT)
      .single();
    if (error) throw error;

    const { error: moveError } = await supabase.from('input_movements').insert({
      farm_id: farmId,
      product_id: input.product_id,
      lot_id: data.id,
      movement_type: 'receipt',
      quantity: input.quantity_received,
      unit_cost: input.unit_cost ?? null,
      created_by: user.id,
    });
    if (moveError) throw moveError;

    await auditFarm(user.id, 'created', 'input_lot', data.id, { new: input });
    return NextResponse.json({ lot: data }, { status: 201 });
  });
}

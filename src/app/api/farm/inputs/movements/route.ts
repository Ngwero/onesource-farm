import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { INPUT_MOVEMENT_SELECT } from '@/lib/farm/queries';
import { INPUT_MOVEMENT_TYPES, inputMovementSchema } from '@/lib/farm/schemas';

export async function GET(request: Request) {
  return withPermission('procurement.view', async () => {
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    let query = supabase.from('input_movements').select(INPUT_MOVEMENT_SELECT).eq('farm_id', farmId);
    const productId = url.searchParams.get('product_id');
    const lotId = url.searchParams.get('lot_id');
    const type = url.searchParams.get('type');
    if (productId) query = query.eq('product_id', productId);
    if (lotId) query = query.eq('lot_id', lotId);
    if (type && (INPUT_MOVEMENT_TYPES as readonly string[]).includes(type)) query = query.eq('movement_type', type);
    const { data, error } = await query.order('moved_at', { ascending: false }).limit(500);
    if (error) throw error;
    return NextResponse.json({ movements: data ?? [] });
  });
}

/** Receipt / issue / waste / return / adjustment against the input store. */
export async function POST(request: Request) {
  return withPermission(undefined, async ({ user, can }) => {
    if (!can('procurement.manage') && !can('activities.record')) {
      throw new HttpError('You do not have permission to record input movements.', 403);
    }
    const input = await parseBody(request, inputMovementSchema);
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

    type LotStock = {
      id: string;
      product_id: string;
      quantity_remaining: number;
      quantity_received: number;
      unit_cost: number | null;
    };
    let lot: LotStock | null = null;
    if (input.lot_id) {
      const { data, error: lotError } = await supabase
        .from('input_lots')
        .select('id, product_id, quantity_remaining, quantity_received, unit_cost')
        .eq('id', input.lot_id)
        .eq('farm_id', farmId)
        .maybeSingle();
      if (lotError) throw lotError;
      if (!data) throw new HttpError('Lot not found on this farm.', 400, { lot_id: 'Not found' });
      if (data.product_id !== input.product_id) {
        throw new HttpError('Lot does not belong to this product.', 400, { lot_id: 'Wrong product' });
      }
      lot = data as LotStock;
      if (['issue', 'waste'].includes(input.movement_type) && Number(lot.quantity_remaining) < input.quantity) {
        throw new HttpError('Not enough stock remaining on this lot.', 400, { quantity: 'Exceeds remaining' });
      }
    }

    const { data, error } = await supabase
      .from('input_movements')
      .insert({
        farm_id: farmId,
        product_id: input.product_id,
        lot_id: input.lot_id ?? null,
        movement_type: input.movement_type,
        quantity: input.quantity,
        unit_cost: input.unit_cost ?? lot?.unit_cost ?? null,
        activity_id: input.activity_id ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        created_by: user.id,
      })
      .select(INPUT_MOVEMENT_SELECT)
      .single();
    if (error) throw error;

    if (lot) {
      if (['receipt', 'return'].includes(input.movement_type)) {
        const nextRemaining = Number(lot.quantity_remaining) + input.quantity;
        const nextReceived =
          input.movement_type === 'receipt'
            ? Math.max(Number(lot.quantity_received), nextRemaining)
            : Math.max(Number(lot.quantity_received), nextRemaining);
        const { error: lotUpError } = await supabase
          .from('input_lots')
          .update({ quantity_remaining: nextRemaining, quantity_received: nextReceived })
          .eq('id', lot.id)
          .eq('farm_id', farmId);
        if (lotUpError) throw lotUpError;
      } else if (['issue', 'waste'].includes(input.movement_type)) {
        const { error: decError } = await supabase
          .from('input_lots')
          .update({ quantity_remaining: Number(lot.quantity_remaining) - input.quantity })
          .eq('id', lot.id)
          .eq('farm_id', farmId)
          .gte('quantity_remaining', input.quantity);
        if (decError) throw decError;
      }
    }

    await auditFarm(user.id, 'created', 'input_movement', data.id, { new: input });
    return NextResponse.json({ movement: data }, { status: 201 });
  });
}

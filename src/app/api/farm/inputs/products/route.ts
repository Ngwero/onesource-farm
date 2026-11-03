import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { INPUT_PRODUCT_SELECT } from '@/lib/farm/queries';
import { inputProductSchema } from '@/lib/farm/schemas';

export async function GET(request: Request) {
  return withPermission(undefined, async ({ can }) => {
    if (!can('procurement.view') && !can('activities.record') && !can('activities.view')) {
      throw new HttpError('You do not have permission to view input products.', 403);
    }
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    let query = supabase.from('input_products').select(INPUT_PRODUCT_SELECT).eq('farm_id', farmId);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    const { data, error } = await query.order('name');
    if (error) throw error;
    return NextResponse.json({ products: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission('procurement.manage', async ({ user }) => {
    const input = await parseBody(request, inputProductSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('input_products')
      .insert({ ...input, farm_id: farmId, created_by: user.id })
      .select(INPUT_PRODUCT_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'created', 'input_product', data.id, { new: input });
    return NextResponse.json({ product: data }, { status: 201 });
  });
}

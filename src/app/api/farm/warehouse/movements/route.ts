import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { MOVEMENT_SELECT } from '@/lib/farm/queries';
import { MOVEMENT_TYPES } from '@/lib/farm/schemas';

export async function GET(request: Request) {
  return withPermission('warehouse.view', async () => {
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    let query = supabase.from('stock_movements').select(MOVEMENT_SELECT).eq('farm_id', farmId);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const type = url.searchParams.get('type');
    if (from) query = query.gte('movement_date', from);
    if (to) query = query.lte('movement_date', to);
    if (type && (MOVEMENT_TYPES as readonly string[]).includes(type)) query = query.eq('movement_type', type);
    const { data, error } = await query
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ movements: data ?? [] });
  });
}

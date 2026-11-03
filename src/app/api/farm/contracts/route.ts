import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { CONTRACT_SELECT } from '@/lib/farm/queries';
import { contractSchema } from '@/lib/farm/schemas';

export async function GET(request: Request) {
  return withPermission('contracts.view', async () => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const buyerId = new URL(request.url).searchParams.get('buyer_id');
    let query = supabase
      .from('buyer_contracts')
      .select(CONTRACT_SELECT)
      .eq('farm_id', farmId)
      .order('start_date', { ascending: false });
    if (buyerId) query = query.eq('buyer_id', buyerId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ contracts: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission('contracts.manage', async ({ user }) => {
    const input = await parseBody(request, contractSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const { data: buyer, error: buyerError } = await supabase
      .from('buyers')
      .select('id')
      .eq('id', input.buyer_id)
      .eq('farm_id', farmId)
      .maybeSingle();
    if (buyerError) throw buyerError;
    if (!buyer) throw new HttpError('Select a buyer on this farm.', 400, { buyer_id: 'Not found' });

    const { data, error } = await supabase
      .from('buyer_contracts')
      .insert({ ...input, farm_id: farmId, created_by: user.id })
      .select(CONTRACT_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'created', 'buyer_contract', data.id, { new: input });
    return NextResponse.json({ contract: data }, { status: 201 });
  });
}

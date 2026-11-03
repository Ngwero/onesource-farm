import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { SHIPMENT_SELECT } from '@/lib/farm/queries';
import { shipmentSchema } from '@/lib/farm/schemas';

async function assertBuyerAndContract(
  supabase: ReturnType<typeof createServiceClient>,
  farmId: string,
  buyerId: string,
  contractId: string | null | undefined
) {
  const { data: buyer, error: buyerError } = await supabase
    .from('buyers')
    .select('id')
    .eq('id', buyerId)
    .eq('farm_id', farmId)
    .maybeSingle();
  if (buyerError) throw buyerError;
  if (!buyer) throw new HttpError('Select a buyer on this farm.', 400, { buyer_id: 'Not found' });

  if (!contractId) return;
  const { data: contract, error: contractError } = await supabase
    .from('buyer_contracts')
    .select('id, buyer_id')
    .eq('id', contractId)
    .eq('farm_id', farmId)
    .maybeSingle();
  if (contractError) throw contractError;
  if (!contract) throw new HttpError('Select a contract on this farm.', 400, { contract_id: 'Not found' });
  if (contract.buyer_id !== buyerId) {
    throw new HttpError('The contract must belong to the selected buyer.', 400, {
      contract_id: 'Does not match buyer',
    });
  }
}

export async function GET(request: Request) {
  return withPermission('shipments.view', async () => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const params = new URL(request.url).searchParams;
    const buyerId = params.get('buyer_id');
    const status = params.get('status');
    let query = supabase
      .from('shipments')
      .select(SHIPMENT_SELECT)
      .eq('farm_id', farmId)
      .order('created_at', { ascending: false });
    if (buyerId) query = query.eq('buyer_id', buyerId);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ shipments: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission('shipments.manage', async ({ user }) => {
    const input = await parseBody(request, shipmentSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    await assertBuyerAndContract(supabase, farmId, input.buyer_id, input.contract_id);

    const { data, error } = await supabase
      .from('shipments')
      .insert({ ...input, farm_id: farmId, created_by: user.id })
      .select(SHIPMENT_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'created', 'shipment', data.id, { new: input });
    return NextResponse.json({ shipment: data }, { status: 201 });
  });
}

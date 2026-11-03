import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { SHIPMENT_SELECT } from '@/lib/farm/queries';
import { shipmentSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

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

export async function GET(_request: Request, { params }: Params) {
  return withPermission('shipments.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('shipments')
      .select(SHIPMENT_SELECT)
      .eq('id', id)
      .eq('farm_id', farmId)
      .single();
    if (error) throw error;
    return NextResponse.json({ shipment: data });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('shipments.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, shipmentSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    await assertBuyerAndContract(supabase, farmId, input.buyer_id, input.contract_id);

    const { data, error } = await supabase
      .from('shipments')
      .update(input)
      .eq('id', id)
      .eq('farm_id', farmId)
      .select(SHIPMENT_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'shipment', id, { new: input });
    return NextResponse.json({ shipment: data });
  });
}

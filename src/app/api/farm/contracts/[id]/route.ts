import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { CONTRACT_SELECT } from '@/lib/farm/queries';
import { contractSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission('contracts.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('buyer_contracts')
      .select(CONTRACT_SELECT)
      .eq('id', id)
      .eq('farm_id', farmId)
      .single();
    if (error) throw error;
    return NextResponse.json({ contract: data });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('contracts.manage', async ({ user }) => {
    const { id } = await params;
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
      .update(input)
      .eq('id', id)
      .eq('farm_id', farmId)
      .select(CONTRACT_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'buyer_contract', id, { new: input });
    return NextResponse.json({ contract: data });
  });
}

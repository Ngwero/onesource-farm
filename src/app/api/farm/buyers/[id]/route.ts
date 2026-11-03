import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { BUYER_SELECT } from '@/lib/farm/queries';
import { buyerSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission('buyers.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('buyers')
      .select(BUYER_SELECT)
      .eq('id', id)
      .eq('farm_id', farmId)
      .single();
    if (error) throw error;
    return NextResponse.json({ buyer: data });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('buyers.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, buyerSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('buyers')
      .update(input)
      .eq('id', id)
      .eq('farm_id', farmId)
      .select(BUYER_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'buyer', id, { new: input });
    return NextResponse.json({ buyer: data });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('buyers.manage', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('buyers')
      .delete()
      .eq('id', id)
      .eq('farm_id', farmId)
      .select('id, code, name')
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'deleted', 'buyer', id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

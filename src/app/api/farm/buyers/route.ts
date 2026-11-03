import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { BUYER_SELECT } from '@/lib/farm/queries';
import { buyerSchema } from '@/lib/farm/schemas';

export async function GET() {
  return withPermission('buyers.view', async () => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('buyers')
      .select(BUYER_SELECT)
      .eq('farm_id', farmId)
      .order('code');
    if (error) throw error;
    return NextResponse.json({ buyers: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission('buyers.manage', async ({ user }) => {
    const input = await parseBody(request, buyerSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('buyers')
      .insert({ ...input, farm_id: farmId, created_by: user.id })
      .select(BUYER_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'created', 'buyer', data.id, { new: input });
    return NextResponse.json({ buyer: data }, { status: 201 });
  });
}

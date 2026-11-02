import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { farmSchema } from '@/lib/farm/schemas';

const FARM_SELECT = '*, manager:users!farms_manager_id_fkey(id, full_name)';

export async function GET() {
  return withPermission('farm.view', async () => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase.from('farms').select(FARM_SELECT).eq('id', farmId).single();
    if (error) throw error;
    return NextResponse.json({ farm: data });
  });
}

export async function PATCH(request: Request) {
  return withPermission('farm.manage', async ({ user }) => {
    const input = await parseBody(request, farmSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('farms')
      .update(input)
      .eq('id', farmId)
      .select(FARM_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'farm', farmId, { new: input });
    return NextResponse.json({ farm: data });
  });
}

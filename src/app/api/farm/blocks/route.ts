import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { BLOCK_SELECT, withCurrentCycle } from '@/lib/farm/queries';
import { blockSchema } from '@/lib/farm/schemas';
import type { BlockRow } from '@/lib/farm/types';

export async function GET() {
  return withPermission('farm.view', async () => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('blocks')
      .select(BLOCK_SELECT)
      .eq('farm_id', farmId)
      .order('code');
    if (error) throw error;
    const blocks = ((data ?? []) as unknown as Omit<BlockRow, 'current_cycle'>[]).map(withCurrentCycle);
    return NextResponse.json({ blocks });
  });
}

export async function POST(request: Request) {
  return withPermission('farm.manage', async ({ user }) => {
    const input = await parseBody(request, blockSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('blocks')
      .insert({ ...input, farm_id: farmId, created_by: user.id })
      .select(BLOCK_SELECT)
      .single();
    if (error) throw error;
    const block = withCurrentCycle(data as unknown as Omit<BlockRow, 'current_cycle'>);
    await auditFarm(user.id, 'created', 'block', block.id, { new: input });
    return NextResponse.json({ block }, { status: 201 });
  });
}

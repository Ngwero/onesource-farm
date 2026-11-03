import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { deleteAttachmentsFor } from '@/lib/farm/operations';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { BLOCK_SELECT, withCurrentCycle } from '@/lib/farm/queries';
import { blockSchema } from '@/lib/farm/schemas';
import type { BlockRow } from '@/lib/farm/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission('farm.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('blocks')
      .select(BLOCK_SELECT)
      .eq('id', id)
      .eq('farm_id', farmId)
      .single();
    if (error) throw error;
    return NextResponse.json({ block: withCurrentCycle(data as unknown as Omit<BlockRow, 'current_cycle'>) });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('farm.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, blockSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('blocks')
      .update(input)
      .eq('id', id)
      .eq('farm_id', farmId)
      .select(BLOCK_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'block', id, { new: input });
    return NextResponse.json({ block: withCurrentCycle(data as unknown as Omit<BlockRow, 'current_cycle'>) });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('farm.manage', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('blocks')
      .delete()
      .eq('id', id)
      .eq('farm_id', farmId)
      .select('id, code, name')
      .single();
    if (error) throw error;
    await deleteAttachmentsFor(supabase, 'block', id);
    await auditFarm(user.id, 'deleted', 'block', id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

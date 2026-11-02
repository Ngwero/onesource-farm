import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { notFound, parseBody } from '@/lib/farm/http';
import { openCycleConflictMessage, validatePlantingCycle } from '@/lib/farm/plantingCycles';
import { CYCLE_SELECT } from '@/lib/farm/queries';
import { plantingCycleSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('farm.manage', async ({ user }) => {
    const { id } = await params;
    const farmId = await getCurrentFarmId();
    const supabase = createServiceClient();

    const { data: existing, error: loadError } = await supabase
      .from('planting_cycles')
      .select('id, crop_id')
      .eq('id', id)
      .eq('farm_id', farmId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) notFound('Planting cycle not found');

    const input = await validatePlantingCycle(
      await parseBody(request, plantingCycleSchema),
      farmId,
      existing.crop_id as string
    );
    const { data, error } = await supabase
      .from('planting_cycles')
      .update(input)
      .eq('id', id)
      .select(CYCLE_SELECT)
      .single();
    if (error) throw openCycleConflictMessage(error) ?? error;
    await auditFarm(user.id, 'updated', 'planting_cycle', id, { new: input });
    return NextResponse.json({ cycle: data });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('farm.manage', async ({ user }) => {
    const { id } = await params;
    const farmId = await getCurrentFarmId();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('planting_cycles')
      .delete()
      .eq('id', id)
      .eq('farm_id', farmId)
      .select('id, block_id, crop_id, planting_date')
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'deleted', 'planting_cycle', id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

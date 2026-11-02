import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { openCycleConflictMessage, validatePlantingCycle } from '@/lib/farm/plantingCycles';
import { CYCLE_SELECT } from '@/lib/farm/queries';
import { plantingCycleSchema } from '@/lib/farm/schemas';

/** Plantings for pickers: ?scope=open (active/harvesting, default) or ?scope=all. */
export async function GET(request: Request) {
  return withPermission(undefined, async () => {
    const scope = new URL(request.url).searchParams.get('scope');
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    let query = supabase
      .from('planting_cycles')
      .select(
        `id, block_id, crop_id, variety_id, season_label, planting_date, expected_yield, actual_yield, yield_unit, status,
         block:blocks!planting_cycles_block_id_farm_id_fkey(id, code, name),
         crop:crops!planting_cycles_crop_id_fkey(id, code, name),
         variety:crop_varieties!planting_cycles_variety_id_crop_id_fkey(id, code, name)`
      )
      .eq('farm_id', farmId);
    if (scope !== 'all') query = query.in('status', ['active', 'harvesting']);
    const { data, error } = await query.order('planting_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ cycles: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission('farm.manage', async ({ user }) => {
    const farmId = await getCurrentFarmId();
    const input = await validatePlantingCycle(await parseBody(request, plantingCycleSchema), farmId);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('planting_cycles')
      .insert({ ...input, farm_id: farmId, created_by: user.id })
      .select(CYCLE_SELECT)
      .single();
    if (error) throw openCycleConflictMessage(error) ?? error;
    await auditFarm(user.id, 'created', 'planting_cycle', (data as { id: string }).id, { new: input });
    return NextResponse.json({ cycle: data }, { status: 201 });
  });
}

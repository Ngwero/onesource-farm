import { NextResponse } from 'next/server';
import { addDays, formatISO } from 'date-fns';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { loadFarmOperations } from '@/lib/farm/dashboard';
import { BLOCK_SELECT, withCurrentCycle } from '@/lib/farm/queries';
import type { BlockRow, FarmOverview, FarmRow } from '@/lib/farm/types';

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export async function GET() {
  return withPermission('farm.view', async ({ can }) => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const [farmRes, blocksRes, operations] = await Promise.all([
      supabase.from('farms').select('*, manager:users!farms_manager_id_fkey(id, full_name)').eq('id', farmId).single(),
      supabase.from('blocks').select(BLOCK_SELECT).eq('farm_id', farmId).order('code'),
      loadFarmOperations(supabase, farmId, can),
    ]);
    if (farmRes.error) throw farmRes.error;
    if (blocksRes.error) throw blocksRes.error;

    const blocks = ((blocksRes.data ?? []) as unknown as Omit<BlockRow, 'current_cycle'>[]).map(withCurrentCycle);
    const today = formatISO(new Date(), { representation: 'date' });
    const in30 = formatISO(addDays(new Date(), 30), { representation: 'date' });

    const blocksByStatus: Record<string, number> = {};
    const crops = new Map<string, FarmOverview['cropBreakdown'][number]>();
    let totalAreaHa = 0;
    let plantedAreaHa = 0;
    let openCycles = 0;
    let expectedYieldOpen = 0;
    let actualYieldOpen = 0;
    const upcoming: FarmOverview['upcomingHarvests'] = [];

    for (const block of blocks) {
      blocksByStatus[block.status] = (blocksByStatus[block.status] ?? 0) + 1;
      totalAreaHa += Number(block.area_ha);

      const cycle = block.current_cycle;
      if (!cycle || !['active', 'harvesting'].includes(cycle.status)) continue;

      const area = Number(cycle.planted_area_ha ?? block.area_ha);
      openCycles += 1;
      plantedAreaHa += area;
      expectedYieldOpen += Number(cycle.expected_yield ?? 0);
      actualYieldOpen += Number(cycle.actual_yield ?? 0);

      const cropName = cycle.crop?.name ?? 'Unknown crop';
      const entry = crops.get(cropName) ?? { crop: cropName, blocks: 0, areaHa: 0, expectedYield: 0, unit: cycle.yield_unit };
      entry.blocks += 1;
      entry.areaHa = round(entry.areaHa + area);
      entry.expectedYield += Number(cycle.expected_yield ?? 0);
      crops.set(cropName, entry);

      if (cycle.expected_harvest_date && cycle.expected_harvest_date >= today && cycle.expected_harvest_date <= in30) {
        upcoming.push({
          cycleId: cycle.id,
          blockId: block.id,
          block: `${block.code} · ${block.name}`,
          crop: cropName,
          variety: cycle.variety?.name ?? null,
          expectedHarvestDate: cycle.expected_harvest_date,
          expectedYield: cycle.expected_yield,
          unit: cycle.yield_unit,
        });
      }
    }

    upcoming.sort((a, b) => a.expectedHarvestDate.localeCompare(b.expectedHarvestDate));

    const overview: FarmOverview = {
      farm: farmRes.data as FarmRow,
      totals: {
        blocks: blocks.length,
        blocksByStatus,
        totalAreaHa: round(totalAreaHa),
        plantedAreaHa: round(plantedAreaHa),
        openCycles,
        activeCrops: crops.size,
        expectedYieldOpen: round(expectedYieldOpen),
        actualYieldOpen: round(actualYieldOpen),
        harvestDueNext30Days: upcoming.length,
      },
      cropBreakdown: [...crops.values()].sort((a, b) => b.areaHa - a.areaHa),
      upcomingHarvests: upcoming,
      blockMap: blocks.map((b) => {
        const c = b.current_cycle;
        return {
          id: b.id,
          code: b.code,
          name: b.name,
          status: b.status,
          areaHa: round(Number(b.area_ha)),
          crop: c?.crop?.name ?? null,
          variety: c?.variety?.name ?? null,
          cycleStatus: c?.status ?? null,
          expectedYield: c?.expected_yield ?? null,
          actualYield: Number(c?.actual_yield ?? 0),
          unit: c?.yield_unit ?? null,
          expectedHarvestDate: c?.expected_harvest_date ?? null,
        };
      }),
      operations,
    };
    return NextResponse.json(overview);
  });
}

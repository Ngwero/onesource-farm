import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, format, subDays } from 'date-fns';
import { gradingStats } from './grading';
import { normalizeBatches } from './operations';
import { HARVEST_SELECT } from './queries';
import type { Permission } from './permissions';
import type { ExecutiveOverview } from './types';

const DAYS = 30;
const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

type RawBatchArg = Parameters<typeof normalizeBatches>[1];

/**
 * Consolidated executive metrics for management: yield, cost, quality, payroll,
 * stock age, and commercial placeholders once buyers/shipments exist.
 */
export async function loadExecutiveOverview(
  supabase: SupabaseClient,
  farmId: string,
  can: (p: Permission) => boolean
): Promise<ExecutiveOverview> {
  const now = new Date();
  const since = format(subDays(now, DAYS - 1), 'yyyy-MM-dd');
  const today = format(now, 'yyyy-MM-dd');

  const result: ExecutiveOverview = {
    since,
    yieldPerHa: null,
    costPerKg: null,
    exportablePct: null,
    rejectionPct: null,
    costsByCrop: [],
    costsByBlock: [],
    payroll: { actual: 0, budget: null, variance: null },
    stockAgeing: [],
    upcomingHarvests: [],
    commercial: { revenueByCrop: [], revenueByBuyer: [], revenueByShipment: [], profitByBlock: [] },
  };

  const settingsRes = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['finance.monthly_payroll_budget', 'finance.monthly_input_budget']);
  if (settingsRes.error) throw settingsRes.error;
  const settings = Object.fromEntries((settingsRes.data ?? []).map((r) => [r.key, Number(r.value) || 0]));
  const payrollBudget = settings['finance.monthly_payroll_budget'] || null;

  const blocksRes = await supabase
    .from('blocks')
    .select(
      `id, code, name, area_ha,
       cycles:planting_cycles(id, status, planted_area_ha, expected_yield, actual_yield, yield_unit, expected_harvest_date,
         crop:crops(id, name))`
    )
    .eq('farm_id', farmId);
  if (blocksRes.error) throw blocksRes.error;

  type Cycle = {
    id: string;
    status: string;
    planted_area_ha: number | null;
    expected_yield: number | null;
    actual_yield: number | null;
    yield_unit: string | null;
    expected_harvest_date: string | null;
    crop: { id: string; name: string } | null;
  };
  type Block = { id: string; code: string; name: string; area_ha: number; cycles: Cycle[] };

  const blocks = (blocksRes.data ?? []) as unknown as Block[];
  let plantedHa = 0;
  let harvestedQty = 0;
  for (const b of blocks) {
    for (const c of b.cycles ?? []) {
      if (!['active', 'harvesting', 'completed'].includes(c.status)) continue;
      const area = Number(c.planted_area_ha ?? b.area_ha);
      if (['active', 'harvesting'].includes(c.status)) plantedHa += area;
      harvestedQty += Number(c.actual_yield ?? 0);
      if (
        c.expected_harvest_date &&
        c.expected_harvest_date >= today &&
        c.expected_harvest_date <= format(addDays(now, 30), 'yyyy-MM-dd')
      ) {
        result.upcomingHarvests.push({
          block: `${b.code} · ${b.name}`,
          crop: c.crop?.name ?? 'Crop',
          expectedHarvestDate: c.expected_harvest_date,
          expectedYield: c.expected_yield,
          unit: c.yield_unit,
        });
      }
    }
  }
  result.upcomingHarvests.sort((a, b) => a.expectedHarvestDate.localeCompare(b.expectedHarvestDate));
  result.yieldPerHa = plantedHa > 0 ? round(harvestedQty / plantedHa, 3) : null;

  if (can('harvest.view') || can('activities.view')) {
    const [harvestRes, activityRes] = await Promise.all([
      can('harvest.view')
        ? supabase.from('harvest_batches').select(HARVEST_SELECT).eq('farm_id', farmId).gte('harvest_date', since)
        : Promise.resolve({ data: [], error: null }),
      can('activities.view')
        ? supabase
            .from('farm_activities')
            .select(
              `id, block_id, crop_id, worker_labour_cost, other_labour_cost, input_cost, total_cost,
               block:blocks!farm_activities_block_id_farm_id_fkey(code, name),
               crop:crops(name)`
            )
            .eq('farm_id', farmId)
            .gte('activity_date', since)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (harvestRes.error) throw harvestRes.error;
    if (activityRes.error) throw activityRes.error;

    const batches = can('harvest.view')
      ? await normalizeBatches(supabase, (harvestRes.data ?? []) as unknown as RawBatchArg)
      : [];

    let gradedQty = 0;
    let exportable = 0;
    let rejected = 0;
    let harvestKg = 0;
    const byCropHarvest = new Map<string, number>();
    const byBlockHarvest = new Map<string, number>();

    for (const b of batches) {
      const qty = Number(b.quantity);
      if (b.unit === 'kg' || b.unit === 'tonne') {
        const kg = b.unit === 'tonne' ? qty * 1000 : qty;
        harvestKg += kg;
        const cropName = b.crop?.name ?? 'Unknown';
        byCropHarvest.set(cropName, (byCropHarvest.get(cropName) ?? 0) + kg);
        const blockKey = b.block?.code ?? '—';
        byBlockHarvest.set(blockKey, (byBlockHarvest.get(blockKey) ?? 0) + kg);
      }
      if (b.grading) {
        const s = gradingStats(b.grading.lines, qty);
        gradedQty += qty;
        exportable += s.exportable;
        rejected += s.rejected;
      }
    }
    result.exportablePct = gradedQty > 0 ? round((exportable / gradedQty) * 100) : null;
    result.rejectionPct = gradedQty > 0 ? round((rejected / gradedQty) * 100) : null;

    type Act = {
      block_id: string;
      crop_id: string | null;
      worker_labour_cost: number;
      other_labour_cost: number;
      input_cost: number;
      total_cost: number;
      block: { code: string; name: string } | null;
      crop: { name: string } | null;
    };
    const activities = (activityRes.data ?? []) as unknown as Act[];

    const cropCosts = new Map<string, { labour: number; inputs: number; total: number; qty: number }>();
    const blockCosts = new Map<string, { labour: number; inputs: number; total: number; qty: number; label: string }>();

    for (const a of activities) {
      const labour = Number(a.worker_labour_cost) + Number(a.other_labour_cost);
      const inputs = Number(a.input_cost);
      const total = Number(a.total_cost);
      const crop = a.crop?.name ?? 'Unassigned crop';
      const c = cropCosts.get(crop) ?? { labour: 0, inputs: 0, total: 0, qty: byCropHarvest.get(crop) ?? 0 };
      c.labour += labour;
      c.inputs += inputs;
      c.total += total;
      cropCosts.set(crop, c);

      const blockLabel = a.block ? `${a.block.code}` : '—';
      const b = blockCosts.get(a.block_id) ?? {
        labour: 0,
        inputs: 0,
        total: 0,
        qty: byBlockHarvest.get(a.block?.code ?? '') ?? 0,
        label: blockLabel,
      };
      b.labour += labour;
      b.inputs += inputs;
      b.total += total;
      blockCosts.set(a.block_id, b);
    }

    const fieldCost = activities.reduce((s, a) => s + Number(a.total_cost), 0);
    const harvestLabour = batches.reduce(
      (s, b) => s + Number(b.worker_labour_cost) + Number(b.other_labour_cost),
      0
    );
    const totalCost = fieldCost + harvestLabour;
    result.costPerKg = harvestKg > 0 ? round(totalCost / harvestKg, 4) : null;

    result.costsByCrop = [...cropCosts.entries()]
      .map(([crop, v]) => ({
        crop,
        labourCost: round(v.labour),
        inputCost: round(v.inputs),
        totalCost: round(v.total),
        harvestedKg: round(v.qty),
        costPerKg: v.qty > 0 ? round(v.total / v.qty, 4) : null,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    result.costsByBlock = [...blockCosts.values()]
      .map((v) => ({
        block: v.label,
        labourCost: round(v.labour),
        inputCost: round(v.inputs),
        totalCost: round(v.total),
        harvestedKg: round(v.qty),
        costPerKg: v.qty > 0 ? round(v.total / v.qty, 4) : null,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }

  if (can('payroll.view')) {
    const monthStart = format(now, 'yyyy-MM-01');
    const { data, error } = await supabase
      .from('payroll_periods')
      .select('id, total_cost, status, period_start')
      .eq('farm_id', farmId)
      .gte('period_start', monthStart);
    if (error) throw error;
    const actual = (data ?? []).reduce((s, p) => s + Number(p.total_cost ?? 0), 0);
    result.payroll = {
      actual: round(actual),
      budget: payrollBudget && payrollBudget > 0 ? payrollBudget : null,
      variance:
        payrollBudget && payrollBudget > 0 ? round(payrollBudget - actual) : null,
    };
  }

  if (can('warehouse.view')) {
    const { data, error } = await supabase
      .from('packing_batches')
      .select(
        `id, packing_no, received_date, package_count, net_weight_per_package, qc_status,
         crop:crops(name), grade:grades(name)`
      )
      .eq('farm_id', farmId)
      .not('received_date', 'is', null);
    if (error) throw error;

    // Stock on hand approximated: batches still received and not fully dispatched are aged by received_date.
    // Full ledger ageing uses stock_movements when available; received_date is the practical shelf clock.
    type Row = {
      id: string;
      packing_no: string;
      received_date: string;
      package_count: number;
      net_weight_per_package: number;
      qc_status: string;
      crop: { name: string } | null;
      grade: { name: string } | null;
    };
    const rows = (data ?? []) as unknown as Row[];
    const buckets = [
      { label: '0–3 days', min: 0, max: 3, kg: 0, batches: 0 },
      { label: '4–7 days', min: 4, max: 7, kg: 0, batches: 0 },
      { label: '8–14 days', min: 8, max: 14, kg: 0, batches: 0 },
      { label: '15+ days', min: 15, max: 9999, kg: 0, batches: 0 },
    ];
    for (const r of rows) {
      const age = Math.floor((now.getTime() - new Date(r.received_date).getTime()) / 86_400_000);
      const kg = Number(r.package_count) * Number(r.net_weight_per_package);
      const bucket = buckets.find((b) => age >= b.min && age <= b.max) ?? buckets[buckets.length - 1];
      bucket.kg += kg;
      bucket.batches += 1;
    }
    result.stockAgeing = buckets.map((b) => ({
      bucket: b.label,
      batches: b.batches,
      kg: round(b.kg),
    }));
  }

  if (can('shipments.view') || can('buyers.view') || can('profitability.view')) {
    const [shipRes, lineRes] = await Promise.all([
      supabase
        .from('shipments')
        .select(
          `id, shipment_no, invoice_amount, invoice_currency, payment_status, status,
           buyer:buyers(name), contract:buyer_contracts(crop_id, crop:crops(name))`
        )
        .eq('farm_id', farmId)
        .neq('status', 'cancelled'),
      supabase
        .from('shipment_lines')
        .select(
          `net_weight, shipment_id,
           packing_batch:packing_batches(crop_id, crop:crops(name),
             harvest_batch:harvest_batches(block:blocks(code)))`
        ),
    ]);
    // Tables may not exist yet on environments that have not run migration 025.
    if (!shipRes.error && shipRes.data) {
      type Ship = {
        id: string;
        shipment_no: string;
        invoice_amount: number | null;
        invoice_currency: string | null;
        payment_status: string;
        status: string;
        buyer: { name: string } | null;
        contract: { crop: { name: string } | null } | null;
      };
      const ships = shipRes.data as unknown as Ship[];
      const byBuyer = new Map<string, number>();
      const byCrop = new Map<string, number>();
      const byShipment: ExecutiveOverview['commercial']['revenueByShipment'] = [];
      for (const s of ships) {
        const amt = Number(s.invoice_amount ?? 0);
        if (amt <= 0) continue;
        const buyer = s.buyer?.name ?? 'Unknown buyer';
        byBuyer.set(buyer, (byBuyer.get(buyer) ?? 0) + amt);
        const crop = s.contract?.crop?.name ?? 'Unassigned';
        byCrop.set(crop, (byCrop.get(crop) ?? 0) + amt);
        byShipment.push({
          shipment: s.shipment_no,
          buyer,
          amount: round(amt),
          currency: s.invoice_currency ?? 'USD',
          paymentStatus: s.payment_status,
        });
      }
      result.commercial.revenueByBuyer = [...byBuyer.entries()]
        .map(([buyer, amount]) => ({ buyer, amount: round(amount) }))
        .sort((a, b) => b.amount - a.amount);
      result.commercial.revenueByCrop = [...byCrop.entries()]
        .map(([crop, amount]) => ({ crop, amount: round(amount) }))
        .sort((a, b) => b.amount - a.amount);
      result.commercial.revenueByShipment = byShipment.sort((a, b) => b.amount - a.amount);
    }

    if (!lineRes.error && lineRes.data) {
      type Line = {
        net_weight: number;
        packing_batch: {
          crop: { name: string } | null;
          harvest_batch: { block: { code: string } | null } | null;
        } | null;
      };
      const byBlock = new Map<string, { kg: number }>();
      for (const line of lineRes.data as unknown as Line[]) {
        const code = line.packing_batch?.harvest_batch?.block?.code ?? '—';
        const row = byBlock.get(code) ?? { kg: 0 };
        row.kg += Number(line.net_weight);
        byBlock.set(code, row);
      }
      // Profit proxy: shipped kg against block field cost until invoices allocate by block.
      const costMap = new Map(result.costsByBlock.map((c) => [c.block, c]));
      result.commercial.profitByBlock = [...byBlock.entries()].map(([block, v]) => {
        const cost = costMap.get(block)?.totalCost ?? 0;
        return {
          block,
          shippedKg: round(v.kg),
          estimatedCost: round(cost),
          // Revenue allocation by block arrives with invoiced shipments; show cost basis for now.
          estimatedProfit: null as number | null,
        };
      });
    }
  }

  return result;
}

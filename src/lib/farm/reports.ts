import type { SupabaseClient } from '@supabase/supabase-js';
import { loadExecutiveOverview } from './executive';
import { toCsv } from './csv';
import { normalizeBatches } from './operations';
import { withStock } from './packhouse';
import type { Permission } from './permissions';
import { ACTIVITY_SELECT, HARVEST_SELECT, PACKING_SELECT, WORKER_SELECT, single } from './queries';
import type { HarvestBatchRow, PackingBatchRow, WorkerRow } from './types';

import { canExportReport, type ReportType } from './reportTypes';
export { REPORT_TYPES, canExportReport, isReportType, type ReportType } from './reportTypes';

type Named = { name: string } | { name: string }[] | null;
type Coded = { code: string; name: string } | { code: string; name: string }[] | null;

export async function buildReportCsv(
  supabase: SupabaseClient,
  farmId: string,
  type: ReportType,
  can: (p: Permission) => boolean
): Promise<{ filename: string; csv: string }> {
  if (!canExportReport(type, can)) throw new Error('You do not have permission to export this report.');
  const stamp = new Date().toISOString().slice(0, 10);

  switch (type) {
    case 'executive': {
      const overview = await loadExecutiveOverview(supabase, farmId, can);
      const rows: (string | number | null)[][] = [
        ['KPI', 'Yield per ha', overview.yieldPerHa],
        ['KPI', 'Cost per kg', overview.costPerKg],
        ['KPI', 'Exportable %', overview.exportablePct],
        ['KPI', 'Rejection %', overview.rejectionPct],
        ['KPI', 'Payroll actual', overview.payroll.actual],
        ['KPI', 'Payroll budget', overview.payroll.budget],
        ['KPI', 'Payroll variance', overview.payroll.variance],
        ...overview.costsByCrop.map((r) => [
          'Cost by crop',
          r.crop,
          r.labourCost,
          r.inputCost,
          r.totalCost,
          r.harvestedKg,
          r.costPerKg,
        ]),
        ...overview.costsByBlock.map((r) => [
          'Cost by block',
          r.block,
          r.labourCost,
          r.inputCost,
          r.totalCost,
          r.harvestedKg,
          r.costPerKg,
        ]),
        ...overview.stockAgeing.map((r) => ['Stock ageing', r.bucket, r.batches, r.kg]),
        ...overview.upcomingHarvests.map((r) => [
          'Upcoming harvest',
          r.block,
          r.crop,
          r.expectedHarvestDate,
          r.expectedYield,
          r.unit,
        ]),
        ...overview.commercial.revenueByBuyer.map((r) => ['Revenue by buyer', r.buyer, r.amount]),
        ...overview.commercial.revenueByShipment.map((r) => [
          'Shipment',
          r.shipment,
          r.buyer,
          r.amount,
          r.currency,
          r.paymentStatus,
        ]),
      ];
      return {
        filename: `executive-kpis-${stamp}.csv`,
        csv: toCsv(
          ['Section', 'Label', 'Value1', 'Value2', 'Value3', 'Value4', 'Value5'],
          rows
        ),
      };
    }

    case 'activities': {
      const { data, error } = await supabase
        .from('farm_activities')
        .select(ACTIVITY_SELECT)
        .eq('farm_id', farmId)
        .order('activity_date', { ascending: false })
        .limit(2000);
      if (error) throw error;
      const rows = (data ?? []).map((a) => {
        const block = single(a.block as Coded);
        const crop = single(a.crop as Named);
        const typeRow = single(a.activity_type as Named);
        return [
          a.activity_date as string,
          block ? `${block.code}` : '',
          crop?.name ?? '',
          typeRow?.name ?? '',
          Number(a.worker_labour_cost ?? 0) + Number(a.other_labour_cost ?? 0),
          a.input_cost as number,
          a.notes as string | null,
        ];
      });
      return {
        filename: `activities-${stamp}.csv`,
        csv: toCsv(['Date', 'Block', 'Crop', 'Activity', 'Labour cost', 'Input cost', 'Notes'], rows),
      };
    }

    case 'harvests': {
      const { data, error } = await supabase
        .from('harvest_batches')
        .select(HARVEST_SELECT)
        .eq('farm_id', farmId)
        .order('harvest_date', { ascending: false })
        .limit(2000);
      if (error) throw error;
      const batches = await normalizeBatches(supabase, (data ?? []) as never);
      const rows = batches.map((b: HarvestBatchRow) => [
        b.batch_no,
        b.harvest_date,
        b.block?.code ?? '',
        b.crop?.name ?? '',
        b.quantity,
        b.unit,
        b.status,
        b.qc_status,
      ]);
      return {
        filename: `harvests-${stamp}.csv`,
        csv: toCsv(['Batch', 'Date', 'Block', 'Crop', 'Quantity', 'Unit', 'Status', 'QC'], rows),
      };
    }

    case 'workers': {
      const { data, error } = await supabase
        .from('workers')
        .select(WORKER_SELECT)
        .eq('farm_id', farmId)
        .order('worker_code');
      if (error) throw error;
      const rows = ((data ?? []) as unknown as WorkerRow[]).map((w) => [
        w.worker_code,
        w.full_name,
        w.category,
        w.job_role,
        w.status,
        w.pay_basis,
        w.daily_rate,
        w.monthly_salary,
        w.phone,
        w.start_date,
      ]);
      return {
        filename: `workers-${stamp}.csv`,
        csv: toCsv(
          ['Code', 'Name', 'Category', 'Role', 'Status', 'Pay basis', 'Daily rate', 'Monthly salary', 'Phone', 'Start date'],
          rows
        ),
      };
    }

    case 'stock': {
      const { data, error } = await supabase
        .from('packing_batches')
        .select(PACKING_SELECT)
        .eq('farm_id', farmId)
        .order('packing_date', { ascending: false })
        .limit(2000);
      if (error) throw error;
      const batches = await withStock(supabase, farmId, (data ?? []) as never);
      const rows = batches.map((b: PackingBatchRow) => [
        b.packing_no,
        b.packing_date,
        b.crop?.name ?? '',
        b.grade?.name ?? '',
        b.package_count,
        b.net_weight,
        b.location?.name ?? '',
        b.stock.available,
        b.stock.reserved,
        b.stock.dispatched,
        b.qc_status,
      ]);
      return {
        filename: `stock-${stamp}.csv`,
        csv: toCsv(
          [
            'Packing no',
            'Date',
            'Crop',
            'Grade',
            'Packages',
            'Net kg',
            'Location',
            'Available',
            'Reserved',
            'Dispatched',
            'QC',
          ],
          rows
        ),
      };
    }

    case 'shipments': {
      const [buyersRes, shipmentsRes] = await Promise.all([
        supabase.from('buyers').select('id, code, name, country, status').eq('farm_id', farmId).order('code'),
        supabase
          .from('shipments')
          .select(
            'shipment_no, status, destination, carrier, etd, eta, dispatched_at, invoice_no, invoice_amount, invoice_currency, payment_status, buyer:buyers(code, name)'
          )
          .eq('farm_id', farmId)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);
      if (buyersRes.error) throw buyersRes.error;
      if (shipmentsRes.error) throw shipmentsRes.error;
      const buyerRows = (buyersRes.data ?? []).map((b) => [
        'buyer',
        b.code as string,
        b.name as string,
        b.country as string | null,
        b.status as string,
        '',
        '',
        '',
      ]);
      const shipmentRows = (shipmentsRes.data ?? []).map((s) => {
        const buyer = single(s.buyer as Coded);
        return [
          'shipment',
          s.shipment_no as string,
          buyer ? `${buyer.code} · ${buyer.name}` : '',
          s.destination as string | null,
          s.status as string,
          s.etd as string | null,
          s.invoice_amount as number | null,
          s.payment_status as string,
        ];
      });
      return {
        filename: `buyers-shipments-${stamp}.csv`,
        csv: toCsv(
          ['Kind', 'Code / shipment', 'Name / buyer', 'Country / destination', 'Status', 'ETD', 'Invoice amount', 'Payment'],
          [...buyerRows, ...shipmentRows]
        ),
      };
    }
  }
}

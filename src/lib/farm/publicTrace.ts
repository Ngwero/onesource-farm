import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http';
import { harvestIdForPacking, loadPackingBatches, loadInspections, loadMovements } from './packhouse';
import { HARVEST_SELECT, single } from './queries';
import { normalizeBatches } from './operations';

export type PublicTrace = {
  farmName: string;
  tokenLabel: string | null;
  subjectType: 'harvest_batch' | 'packing_batch';
  crop: string | null;
  variety: string | null;
  harvestDate: string | null;
  harvestBatchNo: string | null;
  blockCode: string | null;
  qcResult: string | null;
  packing: {
    packingNo: string;
    packingDate: string;
    grade: string | null;
    packageCount: number;
    netWeight: number | null;
    qcStatus: string;
  }[];
  dispatch: {
    reference: string | null;
    packages: number;
    movedAt: string;
  }[];
  shipment: {
    shipmentNo: string;
    destination: string | null;
    status: string;
    etd: string | null;
  }[];
};

/**
 * Public, read-only trail for a QR token. No costs, worker names, phones, or other PII.
 * Only active tokens that resolve to an approved / released QC trail are returned.
 */
export async function loadPublicTrace(supabase: SupabaseClient, token: string): Promise<PublicTrace> {
  const { data: row, error } = await supabase
    .from('batch_trace_tokens')
    .select('id, farm_id, subject_type, harvest_batch_id, packing_batch_id, label, is_active')
    .eq('public_token', token)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new HttpError('This trace link is invalid or has been deactivated.', 404);

  const farmRes = await supabase.from('farms').select('name').eq('id', row.farm_id).maybeSingle();
  if (farmRes.error) throw farmRes.error;
  const farmName = (farmRes.data?.name as string) ?? 'Farm';

  const farmId = row.farm_id as string;
  let harvestId: string;
  let focusPackingId: string | null = null;
  if (row.subject_type === 'packing_batch') {
    focusPackingId = row.packing_batch_id as string;
    harvestId = await harvestIdForPacking(supabase, farmId, focusPackingId);
  } else {
    harvestId = row.harvest_batch_id as string;
  }

  const { data, error: harvestErr } = await supabase
    .from('harvest_batches')
    .select(HARVEST_SELECT)
    .eq('id', harvestId)
    .eq('farm_id', farmId)
    .single();
  if (harvestErr) throw harvestErr;
  const [harvest] = await normalizeBatches(supabase, [data as never]);

  const harvestInspections = await loadInspections(supabase, farmId, {
    column: 'harvest_batch_id',
    ids: [harvest.id],
  });
  const packingRows = await loadPackingBatches(supabase, farmId, { harvestId: harvest.id });
  const packingIds = packingRows.map((p) => p.id);
  const [movements, packingInspections] = await Promise.all([
    loadMovements(supabase, farmId, packingIds),
    loadInspections(supabase, farmId, { column: 'packing_batch_id', ids: packingIds }),
  ]);

  const packingFocus = focusPackingId
    ? packingRows.filter((p) => p.id === focusPackingId)
    : packingRows;

  const approved =
    harvest.qc_status === 'approved' ||
    harvest.qc_status === 'released' ||
    packingFocus.some((p) => p.qc_status === 'approved' || p.qc_status === 'released') ||
    harvestInspections.some((i) => i.result === 'pass' || i.review_status === 'approved') ||
    packingInspections.some((i) => i.result === 'pass' || i.review_status === 'approved');

  if (!approved) {
    throw new HttpError('This batch is not yet available for public tracing.', 404);
  }

  const latestQc =
    [...harvestInspections, ...packingInspections]
      .filter((i) => i.result || i.review_status)
      .sort((a, b) => String(b.inspection_date ?? b.created_at).localeCompare(String(a.inspection_date ?? a.created_at)))[0] ??
    null;

  const qcResult =
    latestQc?.result ??
    latestQc?.review_status ??
    (focusPackingId
      ? packingFocus[0]?.qc_status ?? harvest.qc_status
      : harvest.qc_status);

  const dispatch = movements
    .filter((m) => m.movement_type === 'dispatch')
    .filter((m) => !focusPackingId || m.packing_batch_id === focusPackingId)
    .map((m) => ({
      reference: m.reference,
      packages: m.packages,
      movedAt: m.movement_date,
    }));

  const packingIdsForShip = focusPackingId ? [focusPackingId] : packingIds;
  let shipment: PublicTrace['shipment'] = [];
  if (packingIdsForShip.length) {
    const linesRes = await supabase
      .from('shipment_lines')
      .select('packing_batch_id, shipment:shipments!inner(shipment_no, destination, status, etd, farm_id)')
      .in('packing_batch_id', packingIdsForShip);
    if (linesRes.error) throw linesRes.error;
    const seen = new Set<string>();
    for (const line of linesRes.data ?? []) {
      const ship = single(
        line.shipment as
          | { shipment_no: string; destination: string | null; status: string; etd: string | null; farm_id: string }
          | {
              shipment_no: string;
              destination: string | null;
              status: string;
              etd: string | null;
              farm_id: string;
            }[]
          | null
      );
      if (!ship || ship.farm_id !== farmId || seen.has(ship.shipment_no)) continue;
      seen.add(ship.shipment_no);
      shipment.push({
        shipmentNo: ship.shipment_no,
        destination: ship.destination,
        status: ship.status,
        etd: ship.etd,
      });
    }
  }

  return {
    farmName,
    tokenLabel: (row.label as string | null) ?? null,
    subjectType: row.subject_type as 'harvest_batch' | 'packing_batch',
    crop: harvest.crop?.name ?? null,
    variety: harvest.variety?.name ?? null,
    harvestDate: harvest.harvest_date,
    harvestBatchNo: harvest.batch_no,
    blockCode: harvest.block?.code ?? null,
    qcResult,
    packing: packingFocus.map((p) => ({
      packingNo: p.packing_no,
      packingDate: p.packing_date,
      grade: p.grade?.name ?? null,
      packageCount: p.package_count,
      netWeight: p.net_weight,
      qcStatus: p.qc_status,
    })),
    dispatch,
    shipment,
  };
}

export function newPublicToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

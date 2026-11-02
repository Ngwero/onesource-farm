import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { loadInspection, normalizeInspection, qcRpcArgs } from '@/lib/farm/packhouse';
import { QC_SELECT } from '@/lib/farm/queries';
import { qcInspectionSchema, REVIEW_STATUSES } from '@/lib/farm/schemas';
import type { QcInspectionRow } from '@/lib/farm/types';

export async function GET(request: Request) {
  return withPermission('qc.view', async () => {
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    let query = supabase.from('qc_inspections').select(QC_SELECT).eq('farm_id', farmId);
    const review = url.searchParams.get('review_status');
    const subject = url.searchParams.get('subject_type');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const harvestId = url.searchParams.get('harvest_batch_id');
    if (harvestId) query = query.eq('harvest_batch_id', harvestId);
    if (review && (REVIEW_STATUSES as readonly string[]).includes(review)) query = query.eq('review_status', review);
    if (subject === 'harvest_batch' || subject === 'packing_batch') query = query.eq('subject_type', subject);
    if (from) query = query.gte('inspection_date', from);
    if (to) query = query.lte('inspection_date', to);
    const { data, error } = await query
      .order('inspection_date', { ascending: false })
      .order('inspection_no', { ascending: false })
      .limit(500);
    if (error) throw error;
    const inspections = ((data ?? []) as unknown as QcInspectionRow[]).map(normalizeInspection);
    return NextResponse.json({ inspections });
  });
}

export async function POST(request: Request) {
  return withPermission('qc.inspect', async ({ user }) => {
    const input = await parseBody(request, qcInspectionSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data: id, error } = await supabase.rpc('farm_save_qc_inspection', qcRpcArgs(null, farmId, user.id, input));
    if (error) throw error;
    const inspection = await loadInspection(supabase, farmId, id as string);
    await auditFarm(user.id, 'created', 'qc_inspection', inspection.id, {
      new: { ...input, inspection_no: inspection.inspection_no },
    });
    return NextResponse.json({ inspection }, { status: 201 });
  });
}

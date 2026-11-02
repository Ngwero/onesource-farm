import { NextResponse } from 'next/server';
import { subDays, format } from 'date-fns';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { single } from '@/lib/farm/queries';

type Named = { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null;

/** What can be inspected (recent harvests, unreleased packed batches) and each crop's active QC criteria. */
export async function GET() {
  return withPermission('qc.inspect', async () => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const since = format(subDays(new Date(), 90), 'yyyy-MM-dd');
    const [harvestRes, packingRes, openRes] = await Promise.all([
      supabase
        .from('harvest_batches')
        .select(
          'id, batch_no, harvest_date, quantity, unit, qc_status, crop_id, crop:crops!harvest_batches_crop_id_fkey(id, code, name), block:blocks!harvest_batches_block_id_farm_id_fkey(id, code, name)'
        )
        .eq('farm_id', farmId)
        .gte('harvest_date', since)
        .order('harvest_date', { ascending: false })
        .limit(300),
      supabase
        .from('packing_batches')
        .select(
          'id, packing_no, packing_date, package_count, net_weight, qc_status, crop_id, crop:crops!packing_batches_crop_id_fkey(id, code, name), grade:grades!packing_batches_grade_id_fkey(id, code, name)'
        )
        .eq('farm_id', farmId)
        .neq('qc_status', 'released')
        .order('packing_date', { ascending: false })
        .limit(300),
      supabase
        .from('qc_inspections')
        .select('harvest_batch_id, packing_batch_id')
        .eq('farm_id', farmId)
        .eq('review_status', 'awaiting_review'),
    ]);
    if (harvestRes.error) throw harvestRes.error;
    if (packingRes.error) throw packingRes.error;
    if (openRes.error) throw openRes.error;

    const open = new Set((openRes.data ?? []).flatMap((o) => [o.harvest_batch_id, o.packing_batch_id].filter(Boolean)));
    const harvests = (harvestRes.data ?? []).map((h) => ({
      ...h,
      crop: single(h.crop as Named),
      block: single(h.block as Named),
      awaiting_review: open.has(h.id),
    }));
    const packing = (packingRes.data ?? []).map((p) => ({
      ...p,
      crop: single(p.crop as Named),
      grade: single(p.grade as Named),
      awaiting_review: open.has(p.id),
    }));

    const cropIds = [...new Set([...harvests, ...packing].map((s) => s.crop_id as string))];
    const { data: criteria, error } = cropIds.length
      ? await supabase
          .from('crop_quality_criteria')
          .select('*')
          .in('crop_id', cropIds)
          .eq('status', 'active')
          .order('sort_order')
      : { data: [], error: null };
    if (error) throw error;

    return NextResponse.json({ harvests, packing, criteria: criteria ?? [] });
  });
}

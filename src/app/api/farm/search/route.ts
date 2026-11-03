import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { HttpError } from '@/lib/farm/http';
import { single } from '@/lib/farm/queries';

type Named = { name: string } | { name: string }[] | null;

/**
 * Thin farm search for the top bar: blocks, workers, harvest batches.
 * Returns only collections the caller can view.
 */
export async function GET(request: Request) {
  return withPermission(undefined, async ({ can }) => {
    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) throw new HttpError('Enter at least 2 characters.', 400);

    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const safe = q.replace(/[%_,()."\\]/g, '');
    const pattern = `%${safe}%`;

    const [blocks, workers, harvests] = await Promise.all([
      can('farm.view')
        ? supabase
            .from('blocks')
            .select('id, code, name, status')
            .eq('farm_id', farmId)
            .or(`code.ilike."${pattern}",name.ilike."${pattern}"`)
            .order('code')
            .limit(8)
        : null,
      can('workforce.view')
        ? supabase
            .from('workers')
            .select('id, worker_code, full_name, status')
            .eq('farm_id', farmId)
            .or(`worker_code.ilike."${pattern}",full_name.ilike."${pattern}"`)
            .order('worker_code')
            .limit(8)
        : null,
      can('harvest.view')
        ? supabase
            .from('harvest_batches')
            .select('id, batch_no, harvest_date, crop:crops!harvest_batches_crop_id_fkey(name)')
            .eq('farm_id', farmId)
            .ilike('batch_no', pattern)
            .order('harvest_date', { ascending: false })
            .limit(8)
        : null,
    ]);

    if (blocks?.error) throw blocks.error;
    if (workers?.error) throw workers.error;
    if (harvests?.error) throw harvests.error;

    return NextResponse.json({
      q,
      blocks: (blocks?.data ?? []).map((b) => ({
        id: b.id as string,
        code: b.code as string,
        name: b.name as string,
        status: b.status as string,
        href: `/farm/blocks/${b.id}`,
      })),
      workers: (workers?.data ?? []).map((w) => ({
        id: w.id as string,
        code: w.worker_code as string,
        name: w.full_name as string,
        status: w.status as string,
        href: `/workforce/workers/${w.id}`,
      })),
      harvestBatches: (harvests?.data ?? []).map((h) => ({
        id: h.id as string,
        code: h.batch_no as string,
        date: h.harvest_date as string,
        crop: single(h.crop as Named)?.name ?? null,
        href: `/harvest/batches/${h.id}`,
      })),
    });
  });
}

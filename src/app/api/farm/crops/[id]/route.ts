import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { cropSchema } from '@/lib/farm/schemas';
import type { CropDetail } from '@/lib/farm/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission('crops.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const [cropRes, cyclesRes] = await Promise.all([
      supabase
        .from('crops')
        .select('*, crop_varieties(*), crop_grades(grade_id), crop_quality_criteria(*)')
        .eq('id', id)
        .single(),
      supabase
        .from('planting_cycles')
        .select('id', { count: 'exact', head: true })
        .eq('crop_id', id)
        .in('status', ['active', 'harvesting']),
    ]);
    if (cropRes.error) throw cropRes.error;
    if (cyclesRes.error) throw cyclesRes.error;

    const { crop_varieties, crop_grades, crop_quality_criteria, ...crop } = cropRes.data as Record<string, unknown> & {
      crop_varieties: CropDetail['varieties'];
      crop_grades: { grade_id: string }[];
      crop_quality_criteria: CropDetail['criteria'];
    };
    const detail = {
      ...crop,
      varieties: [...crop_varieties].sort((a, b) => a.name.localeCompare(b.name)),
      grade_ids: crop_grades.map((g) => g.grade_id),
      criteria: [...crop_quality_criteria].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
      open_cycles: cyclesRes.count ?? 0,
    };
    return NextResponse.json({ crop: detail });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('crops.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, cropSchema);
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('crops').update(input).eq('id', id).select('*').single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'crop', id, { new: input });
    return NextResponse.json({ crop: data });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('crops.manage', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('crops')
      .delete()
      .eq('id', id)
      .select('id, code, name')
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'deleted', 'crop', id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

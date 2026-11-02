import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { cropGradesSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

/** Replace the crop's grading configuration with the given grade set. */
export async function PUT(request: Request, { params }: Params) {
  return withPermission('crops.manage', async ({ user }) => {
    const { id: cropId } = await params;
    const { grade_ids } = await parseBody(request, cropGradesSchema);
    const supabase = createServiceClient();

    const { data: current, error: loadError } = await supabase
      .from('crop_grades')
      .select('grade_id')
      .eq('crop_id', cropId);
    if (loadError) throw loadError;

    const wanted = new Set(grade_ids);
    const existing = new Set((current ?? []).map((r) => r.grade_id as string));
    const toAdd = [...wanted].filter((g) => !existing.has(g));
    const toRemove = [...existing].filter((g) => !wanted.has(g));

    if (toAdd.length) {
      const { error } = await supabase
        .from('crop_grades')
        .insert(toAdd.map((grade_id) => ({ crop_id: cropId, grade_id })));
      if (error) throw error;
    }
    if (toRemove.length) {
      const { error } = await supabase
        .from('crop_grades')
        .delete()
        .eq('crop_id', cropId)
        .in('grade_id', toRemove);
      if (error) throw error;
    }

    await auditFarm(user.id, 'updated', 'crop_grades', cropId, {
      old: { grade_ids: [...existing] },
      new: { grade_ids },
    });
    return NextResponse.json({ grade_ids });
  });
}

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { qualityCriterionSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('crops.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, qualityCriterionSchema);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('crop_quality_criteria')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'crop_quality_criterion', id, { new: input });
    return NextResponse.json({ criterion: data });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('crops.manage', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('crop_quality_criteria')
      .delete()
      .eq('id', id)
      .select('id, crop_id, name')
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'deleted', 'crop_quality_criterion', id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

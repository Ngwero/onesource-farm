import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { qualityCriterionSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withPermission('crops.manage', async ({ user }) => {
    const { id: cropId } = await params;
    const input = await parseBody(request, qualityCriterionSchema);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('crop_quality_criteria')
      .insert({ ...input, crop_id: cropId })
      .select('*')
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'created', 'crop_quality_criterion', data.id, { new: { ...input, crop_id: cropId } });
    return NextResponse.json({ criterion: data }, { status: 201 });
  });
}

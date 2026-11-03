import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { activityRpcArgs, deleteAttachmentsFor, patchActivityWeather } from '@/lib/farm/operations';
import { ACTIVITY_SELECT } from '@/lib/farm/queries';
import { activitySchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission('activities.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('farm_activities')
      .select(ACTIVITY_SELECT)
      .eq('id', id)
      .eq('farm_id', farmId)
      .single();
    if (error) throw error;
    return NextResponse.json({ activity: data });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('activities.record', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, activitySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { error } = await supabase.rpc('farm_save_activity', activityRpcArgs(id, farmId, user.id, input));
    if (error) throw error;
    await patchActivityWeather(supabase, id, farmId, input);
    await auditFarm(user.id, 'updated', 'farm_activity', id, { new: input });
    return NextResponse.json({ id });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('activities.manage', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('farm_activities')
      .delete()
      .eq('id', id)
      .eq('farm_id', farmId)
      .select('id, block_id, activity_type_id, activity_date, total_cost')
      .single();
    if (error) throw error;
    await deleteAttachmentsFor(supabase, 'farm_activity', id);
    await auditFarm(user.id, 'deleted', 'farm_activity', id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

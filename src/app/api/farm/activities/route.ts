import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { activityRpcArgs } from '@/lib/farm/operations';
import { ACTIVITY_SELECT } from '@/lib/farm/queries';
import { activitySchema } from '@/lib/farm/schemas';

export async function GET(request: Request) {
  return withPermission('activities.view', async () => {
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    let query = supabase.from('farm_activities').select(ACTIVITY_SELECT).eq('farm_id', farmId);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const blockId = url.searchParams.get('block_id');
    const cycleId = url.searchParams.get('planting_cycle_id');
    if (from) query = query.gte('activity_date', from);
    if (to) query = query.lte('activity_date', to);
    if (blockId) query = query.eq('block_id', blockId);
    if (cycleId) query = query.eq('planting_cycle_id', cycleId);
    const { data, error } = await query
      .order('activity_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ activities: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission('activities.record', async ({ user }) => {
    const input = await parseBody(request, activitySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data: id, error } = await supabase.rpc('farm_save_activity', activityRpcArgs(null, farmId, user.id, input));
    if (error) throw error;
    await auditFarm(user.id, 'created', 'farm_activity', id as string, { new: input });
    return NextResponse.json({ id }, { status: 201 });
  });
}

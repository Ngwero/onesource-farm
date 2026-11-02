import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { cropForCycle } from '@/lib/farm/operations';
import { INCIDENT_SELECT } from '@/lib/farm/queries';
import { incidentSchema } from '@/lib/farm/schemas';

export async function GET(request: Request) {
  return withPermission('pest.view', async () => {
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    let query = supabase.from('pest_disease_incidents').select(INCIDENT_SELECT).eq('farm_id', farmId);
    const status = url.searchParams.get('status');
    const blockId = url.searchParams.get('block_id');
    if (status === 'open') query = query.neq('status', 'resolved');
    else if (status) query = query.eq('status', status);
    if (blockId) query = query.eq('block_id', blockId);
    const { data, error } = await query.order('date_identified', { ascending: false }).limit(500);
    if (error) throw error;
    return NextResponse.json({ incidents: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission('pest.record', async ({ user }) => {
    const input = await parseBody(request, incidentSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const cropId = await cropForCycle(supabase, farmId, input.block_id, input.planting_cycle_id);
    const { data, error } = await supabase
      .from('pest_disease_incidents')
      .insert({
        ...input,
        resolved_date: input.status === 'resolved' ? input.resolved_date : null,
        crop_id: cropId,
        farm_id: farmId,
        reported_by: user.id,
      })
      .select(INCIDENT_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'created', 'pest_disease_incident', data.id, { new: input });
    return NextResponse.json({ incident: data }, { status: 201 });
  });
}

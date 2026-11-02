import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { cropForCycle, deleteAttachmentsFor } from '@/lib/farm/operations';
import { INCIDENT_SELECT } from '@/lib/farm/queries';
import { incidentSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission('pest.view', async () => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('pest_disease_incidents')
      .select(INCIDENT_SELECT)
      .eq('id', id)
      .eq('farm_id', farmId)
      .single();
    if (error) throw error;
    return NextResponse.json({ incident: data });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('pest.record', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, incidentSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const cropId = await cropForCycle(supabase, farmId, input.block_id, input.planting_cycle_id);
    const { data, error } = await supabase
      .from('pest_disease_incidents')
      .update({ ...input, resolved_date: input.status === 'resolved' ? input.resolved_date : null, crop_id: cropId })
      .eq('id', id)
      .eq('farm_id', farmId)
      .select(INCIDENT_SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'pest_disease_incident', id, { new: input });
    return NextResponse.json({ incident: data });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('pest.record', async ({ user }) => {
    const { id } = await params;
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('pest_disease_incidents')
      .delete()
      .eq('id', id)
      .eq('farm_id', farmId)
      .select('id, name, block_id, date_identified')
      .single();
    if (error) throw error;
    await deleteAttachmentsFor(supabase, 'pest_disease_incident', id);
    await auditFarm(user.id, 'deleted', 'pest_disease_incident', id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

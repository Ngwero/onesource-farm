import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { notFound, parseBody } from '@/lib/farm/http';
import { getMasterDataConfig } from '@/lib/farm/masterData';

type Params = { params: Promise<{ type: string; id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withPermission('admin.settings', async ({ user }) => {
    const { type, id } = await params;
    const config = getMasterDataConfig(type) ?? notFound('Unknown list');
    const input = await parseBody(request, config.schema);
    const supabase = createServiceClient();
    const { data, error } = await supabase.from(config.table).update(input).eq('id', id).select('*').single();
    if (error) throw error;
    await auditFarm(user.id, 'updated', config.entity, id, { new: input });
    return NextResponse.json({ item: data });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission('admin.settings', async ({ user }) => {
    const { type, id } = await params;
    const config = getMasterDataConfig(type) ?? notFound('Unknown list');
    const supabase = createServiceClient();
    const { data, error } = await supabase.from(config.table).delete().eq('id', id).select('*').single();
    if (error) throw error;
    await auditFarm(user.id, 'deleted', config.entity, id, { old: data });
    return NextResponse.json({ ok: true });
  });
}

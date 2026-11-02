import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { notFound, parseBody } from '@/lib/farm/http';
import { getMasterDataConfig } from '@/lib/farm/masterData';

type Params = { params: Promise<{ type: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withPermission(undefined, async () => {
    const { type } = await params;
    const config = getMasterDataConfig(type) ?? notFound('Unknown list');
    const supabase = createServiceClient();
    let query = supabase.from(config.table).select('*');
    for (const o of config.orderBy) query = query.order(o.column, { ascending: o.ascending });
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  });
}

export async function POST(request: Request, { params }: Params) {
  return withPermission('admin.settings', async ({ user }) => {
    const { type } = await params;
    const config = getMasterDataConfig(type) ?? notFound('Unknown list');
    const input = await parseBody(request, config.schema);
    const supabase = createServiceClient();
    const { data, error } = await supabase.from(config.table).insert(input).select('*').single();
    if (error) throw error;
    await auditFarm(user.id, 'created', config.entity, data.id, { new: input });
    return NextResponse.json({ item: data }, { status: 201 });
  });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { HttpError, parseBody } from '@/lib/farm/http';
import { canExportReport, REPORT_TYPES } from '@/lib/farm/reports';

const digestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  report_types: z.array(z.enum(REPORT_TYPES)).min(1),
  cadence: z.enum(['daily', 'weekly']),
  weekday: z.number().int().min(0).max(6).default(1),
  hour_utc: z.number().int().min(0).max(23).default(6),
  is_active: z.boolean().default(true),
});

export async function GET() {
  return withPermission('reports.view', async ({ user }) => {
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('report_digest_subscriptions')
      .select('*')
      .eq('farm_id', farmId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ subscription: data });
  });
}

export async function PUT(request: Request) {
  return withPermission('reports.export', async ({ user, can }) => {
    const input = await parseBody(request, digestSchema);
    if (input.report_types.some((type) => !canExportReport(type, can))) {
      throw new HttpError('You do not have permission to export one of these reports.', 403);
    }
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data, error } = await supabase
      .from('report_digest_subscriptions')
      .upsert(
        {
          farm_id: farmId,
          user_id: user.id,
          email: input.email,
          report_types: input.report_types,
          cadence: input.cadence,
          weekday: input.weekday,
          hour_utc: input.hour_utc,
          is_active: input.is_active,
        },
        { onConflict: 'farm_id,user_id' }
      )
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ subscription: data });
  });
}

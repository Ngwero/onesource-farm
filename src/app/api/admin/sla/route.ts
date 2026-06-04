import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';
import { processSlaChecks } from '@/lib/sla/service';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    const supabase = createServiceClient();

    const [trackingRes, settingsRes] = await Promise.all([
      supabase
        .from('sla_tracking')
        .select(
          `
          *,
          memo:memos(reference_number, subject),
          assignee:users!assigned_to(full_name, email)
        `
        )
        .eq('status', status)
        .order('due_at', { ascending: true })
        .limit(100),
      supabase.from('sla_settings').select('*').order('role_slug'),
    ]);

    if (trackingRes.error) throw trackingRes.error;

    return NextResponse.json({
      tracking: trackingRes.data || [],
      settings: settingsRes.data || [],
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    if (searchParams.get('action') !== 'run_checks') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const result = await processSlaChecks();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return authErrorResponse(err);
  }
}

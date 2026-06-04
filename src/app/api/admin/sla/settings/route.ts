import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const { role_slug, sla_hours, reminder_hours_before, escalation_enabled } =
      await request.json();

    if (!role_slug) {
      return NextResponse.json({ error: 'role_slug required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (sla_hours !== undefined) updates.sla_hours = Number(sla_hours);
    if (reminder_hours_before !== undefined) {
      updates.reminder_hours_before = Number(reminder_hours_before);
    }
    if (escalation_enabled !== undefined) updates.escalation_enabled = Boolean(escalation_enabled);

    const { data, error } = await supabase
      .from('sla_settings')
      .update(updates)
      .eq('role_slug', role_slug)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ setting: data });
  } catch (err) {
    return authErrorResponse(err);
  }
}

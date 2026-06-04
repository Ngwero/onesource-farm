import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('approval_workflows')
      .select(
        `
        id,
        name,
        is_default,
        is_active,
        requires_exco,
        requires_finance,
        memo_types(id, name, slug),
        approval_steps(id, step_order, role_slug, step_name, is_parallel, sla_hours)
      `
      )
      .order('name');

    if (error) throw error;

    const workflows = (data || []).map((w) => ({
      ...w,
      approval_steps: [...((w as { approval_steps?: { step_order: number }[] }).approval_steps || [])].sort(
        (a, b) => a.step_order - b.step_order
      ),
    }));

    return NextResponse.json({ workflows });
  } catch (err) {
    return authErrorResponse(err);
  }
}

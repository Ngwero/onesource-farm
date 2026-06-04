import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';

type StepInput = {
  step_order: number;
  role_slug: string;
  step_name: string;
  is_parallel?: boolean;
  sla_hours?: number;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { name, is_active, requires_exco, requires_finance, steps } = body as {
      name?: string;
      is_active?: boolean;
      requires_exco?: boolean;
      requires_finance?: boolean;
      steps?: StepInput[];
    };

    const supabase = createServiceClient();

    const workflowUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) workflowUpdates.name = name;
    if (is_active !== undefined) workflowUpdates.is_active = is_active;
    if (requires_exco !== undefined) workflowUpdates.requires_exco = requires_exco;
    if (requires_finance !== undefined) workflowUpdates.requires_finance = requires_finance;

    if (Object.keys(workflowUpdates).length > 1) {
      const { error } = await supabase
        .from('approval_workflows')
        .update(workflowUpdates)
        .eq('id', id);
      if (error) throw error;
    }

    if (steps && Array.isArray(steps)) {
      if (steps.length === 0) {
        return NextResponse.json({ error: 'At least one step required' }, { status: 400 });
      }

      const normalized = steps
        .map((s, i) => ({
          workflow_id: id,
          step_order: s.step_order ?? i + 1,
          role_slug: String(s.role_slug).trim(),
          step_name: String(s.step_name).trim(),
          is_parallel: Boolean(s.is_parallel),
          sla_hours: Number(s.sla_hours) || 24,
        }))
        .sort((a, b) => a.step_order - b.step_order)
        .map((s, i) => ({ ...s, step_order: i + 1 }));

      await supabase.from('approval_steps').delete().eq('workflow_id', id);

      const { error: stepsError } = await supabase.from('approval_steps').insert(normalized);
      if (stepsError) throw stepsError;
    }

    const { data: workflow, error: fetchError } = await supabase
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
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const sorted = {
      ...workflow,
      approval_steps: [...((workflow.approval_steps as StepInput[]) || [])].sort(
        (a, b) => a.step_order - b.step_order
      ),
    };

    await logAudit({
      userId: admin.id,
      action: 'status_changed',
      entityType: 'approval_workflow',
      entityId: id,
      newValues: { name, steps_count: steps?.length },
    });

    return NextResponse.json({ workflow: sorted });
  } catch (err) {
    return authErrorResponse(err);
  }
}

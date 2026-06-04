import { createServiceClient } from '@/lib/supabase/server';
import {
  getWorkflowForMemoType,
  isCanonicalItWorkflow,
  type WorkflowDefinition,
  type WorkflowStep,
} from '@/lib/workflow/engine';
import { IT_REQUEST_APPROVAL_STEPS } from '@/lib/workflow/itWorkflowSteps';
import type { ImportanceLevel, MemoTypeSlug } from '@/types';

type WorkflowOptions = {
  requiresFinance?: boolean;
  importanceLevel?: ImportanceLevel;
};

function normalizeItWorkflow(workflow: WorkflowDefinition, memoTypeSlug: MemoTypeSlug): WorkflowDefinition {
  if (memoTypeSlug !== 'it_request') return workflow;
  if (isCanonicalItWorkflow(workflow)) {
    return {
      ...workflow,
      requires_finance: true,
      steps: IT_REQUEST_APPROVAL_STEPS.map((s) => ({ ...s, is_parallel: false })),
    };
  }
  return getWorkflowForMemoType('it_request');
}

function normalizeFinanceWorkflow(
  workflow: WorkflowDefinition,
  memoTypeSlug: MemoTypeSlug
): WorkflowDefinition {
  if (memoTypeSlug !== 'finance_request') return workflow;
  const first = workflow.steps[0];
  const hasDeptHead = workflow.steps.some((s) => s.role_slug === 'department_head');
  if (hasDeptHead || first?.role_slug !== 'finance_reviewer') {
    return getWorkflowForMemoType('finance_request');
  }
  return workflow;
}

function normalizeMarketingWorkflow(
  workflow: WorkflowDefinition,
  memoTypeSlug: MemoTypeSlug
): WorkflowDefinition {
  if (memoTypeSlug !== 'marketing_request') return workflow;
  const hasBusinessHead = workflow.steps.some((s) => s.role_slug === 'business_head');
  const hasFinance = workflow.steps.some((s) => s.role_slug === 'finance_reviewer');
  if (!hasBusinessHead || !hasFinance) {
    return getWorkflowForMemoType('marketing_request');
  }
  return workflow;
}

function normalizeHrWorkflow(workflow: WorkflowDefinition, memoTypeSlug: MemoTypeSlug): WorkflowDefinition {
  if (memoTypeSlug !== 'hr_request') return workflow;
  const first = workflow.steps[0];
  const hasDeptHead = workflow.steps.some((s) => s.role_slug === 'department_head');
  const hasHrReviewer = workflow.steps.some((s) => s.role_slug === 'hr_reviewer');
  if (hasDeptHead || hasHrReviewer || first?.role_slug !== 'finance_reviewer') {
    return getWorkflowForMemoType('hr_request');
  }
  return workflow;
}

function applyExcoOverride(
  memoTypeSlug: MemoTypeSlug,
  options?: WorkflowOptions
): WorkflowDefinition | null {
  if (memoTypeSlug !== 'general_internal' || options?.importanceLevel !== 'exco') return null;
  return {
    name: 'EXCO Approval',
    requires_exco: true,
    steps: [
      {
        step_order: 1,
        role_slug: 'exco_member',
        step_name: 'EXCO Parallel Approval',
        is_parallel: true,
        sla_hours: 72,
      },
    ],
  };
}

/** Load workflow from DB when available, else fall back to built-in defaults. */
export async function resolveWorkflow(
  memoTypeId: string,
  memoTypeSlug: MemoTypeSlug,
  options?: WorkflowOptions
): Promise<WorkflowDefinition> {
  const exco = applyExcoOverride(memoTypeSlug, options);
  if (exco) return exco;

  const supabase = createServiceClient();
  const { data: wf } = await supabase
    .from('approval_workflows')
    .select('id, name, requires_exco, requires_finance, approval_steps(step_order, role_slug, step_name, is_parallel, sla_hours)')
    .eq('memo_type_id', memoTypeId)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle();

  const stepsRaw = (wf as { approval_steps?: WorkflowStep[] } | null)?.approval_steps;
  if (wf && stepsRaw && stepsRaw.length > 0) {
    const steps = [...stepsRaw].sort((a, b) => a.step_order - b.step_order).map((s) => ({
      step_order: s.step_order,
      role_slug: s.role_slug,
      step_name: s.step_name,
      is_parallel: Boolean(s.is_parallel),
      sla_hours: s.sla_hours ?? 24,
    }));
    let workflow: WorkflowDefinition = {
      name: wf.name,
      steps,
      requires_exco: Boolean(wf.requires_exco),
      requires_finance: Boolean(wf.requires_finance),
    };
    workflow = normalizeItWorkflow(workflow, memoTypeSlug);
    workflow = normalizeHrWorkflow(workflow, memoTypeSlug);
    workflow = normalizeMarketingWorkflow(workflow, memoTypeSlug);
    workflow = normalizeFinanceWorkflow(workflow, memoTypeSlug);
    return workflow;
  }

  return getWorkflowForMemoType(memoTypeSlug, options);
}

import { createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { startSlaTracking } from '@/lib/sla/service';
import { notifyApprovers, type MemoNotificationContext } from '@/lib/notifications/service';
import { findApproversForStep } from '@/lib/memo/approvers';
import { resetWorkflowSignaturesForResubmit } from '@/lib/memo/actionTimestamps';
import { syncPreparedSignatureIfBlank } from '@/lib/signature/sync';
import type { WorkflowStep } from '@/lib/workflow/engine';
import type { MemoTypeSlug } from '@/types';

export type SubmitSideEffectsPayload = {
  memoId: string;
  userId: string;
  departmentId: string;
  memoTypeSlug: MemoTypeSlug;
  creatorEmail?: string | null;
  firstStep: WorkflowStep;
  notifyCtx: MemoNotificationContext;
};

async function ensureCreatorPreparedSignature(memoId: string, creatorId: string) {
  const supabase = createServiceClient();

  const { data: creator } = await supabase
    .from('users')
    .select('full_name, title, signature_path')
    .eq('id', creatorId)
    .single();

  if (!creator?.signature_path) return;

  await syncPreparedSignatureIfBlank(memoId, {
    id: creatorId,
    full_name: creator.full_name,
    title: creator.title,
    signature_path: creator.signature_path,
  });
}

/** Notifications, SLA, signatures, audit — run after the submit HTTP response is sent. */
export async function runSubmitMemoSideEffects(payload: SubmitSideEffectsPayload) {
  const { memoId, userId, departmentId, memoTypeSlug, creatorEmail, firstStep, notifyCtx } =
    payload;

  await resetWorkflowSignaturesForResubmit(memoId);

  const [, approverIds] = await Promise.all([
    ensureCreatorPreparedSignature(memoId, userId),
    findApproversForStep(
      firstStep.role_slug,
      departmentId,
      memoTypeSlug,
      firstStep.step_order,
      creatorEmail
    ),
  ]);

  await startSlaTracking(
    memoId,
    firstStep.step_order,
    firstStep.role_slug,
    approverIds[0] ?? null
  );

  await Promise.all([
    notifyApprovers(approverIds, memoId, notifyCtx, 'memo_routed'),
    logAudit({ memoId, userId, action: 'memo_submitted' }),
  ]);
}

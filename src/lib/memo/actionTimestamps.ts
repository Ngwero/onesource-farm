import { createServiceClient } from '@/lib/supabase/server';
import type { ApprovalAction } from '@/types';

export function nowIso(): string {
  return new Date().toISOString();
}

/** Display memo workflow / action times in Uganda local time. */
export function formatActionTimestamp(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleString('en-UG', { timeZone: 'Africa/Kampala' });
}

export async function recordApprovalAction(params: {
  memoId: string;
  stepOrder: number;
  approverId: string;
  action: ApprovalAction;
  comments?: string;
  signaturePath?: string | null;
  delegatedFromId?: string | null;
  isParallel?: boolean;
}) {
  const supabase = createServiceClient();
  const stampedAt = nowIso();

  await supabase.from('approvals').insert({
    memo_id: params.memoId,
    step_order: params.stepOrder,
    approver_id: params.approverId,
    action: params.action,
    comments: params.comments,
    signature_path: params.signaturePath ?? null,
    signed_at: stampedAt,
    delegated_from_id: params.delegatedFromId ?? null,
    is_parallel: params.isParallel ?? false,
    updated_at: stampedAt,
  });
}

/** Clear prior approver signatures when a returned/rejected memo is resubmitted. */
export async function resetWorkflowSignaturesForResubmit(memoId: string) {
  const supabase = createServiceClient();
  await supabase
    .from('signature_records')
    .delete()
    .eq('memo_id', memoId)
    .neq('block_type', 'prepared');
}

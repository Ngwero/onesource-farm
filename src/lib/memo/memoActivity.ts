import { createServiceClient } from '@/lib/supabase/server';
import type { AuditAction } from '@/lib/audit/logger';
import type { MemoActivityItem } from '@/lib/memo/memoActivityTypes';

const AUDIT_LABELS: Partial<Record<AuditAction, string>> = {
  memo_created: 'Memo created',
  memo_submitted: 'Submitted for approval',
  memo_resubmitted: 'Resubmitted after correction',
  memo_approved: 'Approved',
  memo_returned: 'Returned for correction',
  memo_rejected: 'Rejected',
  memo_withdrawn: 'Withdrawn',
  memo_edited: 'Draft updated',
  attachment_uploaded: 'Attachment added',
  attachment_deleted: 'Attachment removed',
};

const APPROVAL_LABELS: Record<string, string> = {
  approve: 'Approved at workflow step',
  return: 'Returned for correction',
  reject: 'Rejected',
};

export async function buildMemoActivity(memoId: string): Promise<MemoActivityItem[]> {
  const supabase = createServiceClient();

  const [{ data: approvals }, { data: audits }] = await Promise.all([
    supabase
      .from('approvals')
      .select('id, action, signed_at, comments, approver:users!approver_id(full_name)')
      .eq('memo_id', memoId)
      .not('signed_at', 'is', null)
      .order('signed_at', { ascending: true }),
    supabase
      .from('audit_logs')
      .select('id, action, created_at, new_values, user:users!user_id(full_name)')
      .eq('memo_id', memoId)
      .in('action', [
        'memo_created',
        'memo_submitted',
        'memo_resubmitted',
        'memo_approved',
        'memo_returned',
        'memo_rejected',
        'memo_withdrawn',
        'memo_edited',
        'attachment_uploaded',
        'attachment_deleted',
      ])
      .order('created_at', { ascending: true }),
  ]);

  const events: MemoActivityItem[] = [];

  for (const row of approvals || []) {
    const action = row.action as string;
    const approver = row.approver as { full_name?: string } | null;
    events.push({
      id: `approval-${row.id}`,
      at: row.signed_at as string,
      label: APPROVAL_LABELS[action] || action,
      actor: approver?.full_name,
      detail: row.comments || undefined,
    });
  }

  for (const row of audits || []) {
    const action = row.action as AuditAction;
    const user = row.user as { full_name?: string } | null;
    const newValues = row.new_values as Record<string, unknown> | null;
    const adminOverride = Boolean(newValues?.admin_override);
    const label = AUDIT_LABELS[action] || action.replace(/_/g, ' ');
    events.push({
      id: `audit-${row.id}`,
      at: row.created_at as string,
      label: adminOverride && action === 'memo_approved' ? 'Approved (admin override)' : label,
      actor: user?.full_name,
      detail:
        typeof newValues?.comments === 'string'
          ? newValues.comments
          : typeof newValues?.reason === 'string'
            ? newValues.reason
            : typeof newValues?.file_name === 'string'
              ? newValues.file_name
              : undefined,
      adminOverride,
    });
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.at}|${event.label}|${event.actor || ''}|${event.detail || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

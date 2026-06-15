import { createServiceClient } from '@/lib/supabase/server';

export type AuditAction =
  | 'memo_created'
  | 'memo_edited'
  | 'memo_submitted'
  | 'memo_resubmitted'
  | 'memo_approved'
  | 'memo_returned'
  | 'memo_rejected'
  | 'memo_withdrawn'
  | 'memo_archived'
  | 'memo_deleted'
  | 'memo_restored'
  | 'memo_permanently_deleted'
  | 'attachment_uploaded'
  | 'attachment_downloaded'
  | 'attachment_deleted'
  | 'signature_placed'
  | 'delegation_created'
  | 'delegation_cancelled'
  | 'memo_shared'
  | 'status_changed'
  | 'comment_added'
  | 'version_created'
  | 'payment_updated';

export async function logAudit(params: {
  memoId?: string;
  userId?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const supabase = await createServiceClient();
    await supabase.from('audit_logs').insert({
      memo_id: params.memoId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_values: params.oldValues,
      new_values: params.newValues,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

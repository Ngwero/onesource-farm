import { logAudit, type AuditAction } from '@/lib/audit/logger';
import {
  notifyApprovers,
  sendNotification,
  type MemoNotificationContext,
  type NotificationEvent,
} from '@/lib/notifications/service';

export type ApprovalNotificationTask =
  | {
      kind: 'single';
      userId: string;
      type: NotificationEvent;
      context: MemoNotificationContext;
      title: string;
      message: string;
      comments?: string;
    }
  | {
      kind: 'approvers';
      userIds: string[];
      type: NotificationEvent;
      context: MemoNotificationContext;
    };

export type ApprovalSideEffectsPayload = {
  memoId: string;
  approverId: string;
  audit: { action: AuditAction; newValues?: Record<string, unknown> };
  notifications: ApprovalNotificationTask[];
};

export function notifyCtxFromMemo(
  memo: {
    reference_number: string;
    subject?: string | null;
    memo_from?: string | null;
  },
  approver?: { full_name?: string | null },
  extras?: Partial<MemoNotificationContext>
): MemoNotificationContext {
  return {
    referenceNumber: memo.reference_number,
    subject: memo.subject,
    memoFrom: memo.memo_from,
    actorName: approver?.full_name ?? undefined,
    ...extras,
  };
}

/** Notifications + audit — run after the approve HTTP response is sent. */
export async function runApprovalSideEffects(payload: ApprovalSideEffectsPayload) {
  const { memoId, approverId, audit, notifications } = payload;

  await Promise.all([
    logAudit({
      memoId,
      userId: approverId,
      action: audit.action,
      newValues: audit.newValues,
    }),
    ...notifications.map(async (task) => {
      if (task.kind === 'approvers') {
        await notifyApprovers(task.userIds, memoId, task.context, task.type);
        return;
      }
      await sendNotification({
        userId: task.userId,
        memoId,
        title: task.title,
        message: task.message,
        type: task.type,
        context: task.context,
        comments: task.comments,
      });
    }),
  ]);
}

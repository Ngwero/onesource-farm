import { createServiceClient } from '@/lib/supabase/server';
import { sendMemoEmailToUser } from './email';

export type NotificationEvent =
  | 'memo_created'
  | 'memo_submitted'
  | 'memo_routed'
  | 'memo_approved'
  | 'memo_returned'
  | 'memo_rejected'
  | 'memo_resubmitted'
  | 'memo_fully_approved'
  | 'memo_trail_fully_approved'
  | 'memo_withdrawn'
  | 'sla_reminder'
  | 'sla_breached'
  | 'memo_shared';

export interface MemoNotificationContext {
  referenceNumber: string;
  subject?: string | null;
  memoFrom?: string | null;
  stepName?: string;
  actorName?: string;
  comments?: string;
}

type MemoEmailCopy = {
  title: string;
  message: string;
  emailSubject: string;
  bodyHtml: string;
  highlightText?: string;
  highlightSubtext?: string;
  bullets?: string[];
};

const EVENT_COPY: Partial<Record<NotificationEvent, (ctx: MemoNotificationContext) => MemoEmailCopy>> = {
  memo_routed: (ctx) => ({
    title: 'Memo pending your approval',
    emailSubject: `[OneSource e-Memo] Action required: ${ctx.referenceNumber}`,
    message: `Memo ${ctx.referenceNumber} is waiting for your approval.`,
    bodyHtml: `<p style="margin:0;">A memo has been routed to you for <strong>approval</strong> on the OneSource e-Memo portal.</p>`,
    highlightText: `Memo : ${ctx.referenceNumber}`,
    highlightSubtext: [
      ctx.subject ? `Subject: ${ctx.subject}` : '',
      ctx.memoFrom ? `From: ${ctx.memoFrom}` : '',
      ctx.stepName ? `Step: ${ctx.stepName}` : '',
      ctx.actorName ? `Submitted by: ${ctx.actorName}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }),
  memo_submitted: (ctx) => ({
    title: 'New memo submitted',
    emailSubject: `[OneSource e-Memo] Submitted: ${ctx.referenceNumber}`,
    message: `Memo ${ctx.referenceNumber} has been submitted.`,
    bodyHtml: `<p style="margin:0;">Your memo has been submitted and is entering the approval workflow.</p>`,
    highlightText: `Memo : ${ctx.referenceNumber}`,
    highlightSubtext: ctx.subject ? `Subject: ${ctx.subject}` : undefined,
  }),
  memo_returned: (ctx) => ({
    title: 'Memo returned for correction',
    emailSubject: `[OneSource e-Memo] Returned: ${ctx.referenceNumber}`,
    message: `Memo ${ctx.referenceNumber} was returned for correction.`,
    bodyHtml: `<p style="margin:0;">Your memo has been <strong>returned</strong> for correction.${ctx.comments ? ` Comment: ${ctx.comments}` : ''}</p>`,
    highlightText: `Memo : ${ctx.referenceNumber}`,
    highlightSubtext: 'Action required: update and resubmit.',
  }),
  memo_resubmitted: (ctx) => ({
    title: 'Memo resubmitted for your approval',
    emailSubject: `[OneSource e-Memo] Resubmitted: ${ctx.referenceNumber}`,
    message: `Memo ${ctx.referenceNumber} was corrected and sent back for approval.`,
    bodyHtml: `<p style="margin:0;">A returned memo has been <strong>updated and resubmitted</strong> to you for approval.</p>`,
    highlightText: `Memo : ${ctx.referenceNumber}`,
    highlightSubtext: [
      ctx.subject ? `Subject: ${ctx.subject}` : '',
      ctx.stepName ? `Step: ${ctx.stepName}` : '',
      ctx.actorName ? `Resubmitted by: ${ctx.actorName}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }),
  memo_rejected: (ctx) => ({
    title: 'Memo rejected',
    emailSubject: `[OneSource e-Memo] Rejected: ${ctx.referenceNumber}`,
    message: `Memo ${ctx.referenceNumber} has been rejected.`,
    bodyHtml: `<p style="margin:0;">Your memo has been <strong>rejected</strong>.${ctx.comments ? ` Reason: ${ctx.comments}` : ''}</p>`,
    highlightText: `Memo : ${ctx.referenceNumber}`,
    highlightSubtext: 'This memo is closed.',
  }),
  memo_fully_approved: (ctx) => ({
    title: 'Memo fully approved',
    emailSubject: `[OneSource e-Memo] Approved: ${ctx.referenceNumber}`,
    message: `Memo ${ctx.referenceNumber} has been fully approved.`,
    bodyHtml: `<p style="margin:0;">Your memo has completed all approval steps and is now <strong>approved</strong>.</p>`,
    highlightText: `Memo : ${ctx.referenceNumber}`,
    highlightSubtext: 'You may export the approved memo as a watermarked PDF (E-Copy).',
  }),
  memo_trail_fully_approved: (ctx) => ({
    title: 'Memo fully approved',
    emailSubject: `[OneSource e-Memo] Approved: ${ctx.referenceNumber}`,
    message: `Memo ${ctx.referenceNumber} has been fully approved.`,
    bodyHtml: `<p style="margin:0;">A memo you were part of in the approval trail is now <strong>fully approved</strong>.</p>`,
    highlightText: `Memo : ${ctx.referenceNumber}`,
    highlightSubtext: [
      ctx.subject ? `Subject: ${ctx.subject}` : '',
      ctx.memoFrom ? `From: ${ctx.memoFrom}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    bullets: [
      'Sign in to view the approved memo and signatures on the portal.',
      'This is an automated notification from OneSource e-Memo.',
    ],
  }),
  memo_approved: (ctx) => ({
    title: 'Memo approved at current step',
    emailSubject: `[OneSource e-Memo] Progress: ${ctx.referenceNumber}`,
    message: `Memo ${ctx.referenceNumber} was approved at the current step.`,
    bodyHtml: `<p style="margin:0;">Your memo has been approved at the current step and moved forward in the workflow.</p>`,
    highlightText: `Memo : ${ctx.referenceNumber}`,
  }),
};

async function loadNotificationChannelFlags(eventType: NotificationEvent): Promise<{
  inApp: boolean;
  email: boolean;
}> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('notification_settings')
    .select('in_app_enabled, email_enabled')
    .eq('event_type', eventType)
    .maybeSingle();

  return {
    inApp: data?.in_app_enabled !== false,
    email: data?.email_enabled !== false,
  };
}

export async function sendNotification(params: {
  userId: string;
  memoId?: string;
  title: string;
  message: string;
  type: NotificationEvent;
  sendEmail?: boolean;
  context?: MemoNotificationContext;
  comments?: string;
  channelFlags?: { inApp: boolean; email: boolean };
}) {
  const supabase = createServiceClient();
  const flags = params.channelFlags ?? (await loadNotificationChannelFlags(params.type));
  const inApp = flags.inApp;

  let notificationId: string | undefined;

  if (inApp) {
    const { data: row } = await supabase
      .from('notifications')
      .insert({
        user_id: params.userId,
        memo_id: params.memoId,
        title: params.title,
        message: params.message,
        type: params.type,
        email_sent: false,
      })
      .select('id')
      .single();
    notificationId = row?.id;
  }

  const shouldEmail = params.sendEmail !== false && flags.email;

  if (shouldEmail) {
    const ctx: MemoNotificationContext = params.context || {
      referenceNumber: params.message,
    };
    if (params.comments) ctx.comments = params.comments;

    const copy = EVENT_COPY[params.type]?.(ctx) || {
      title: params.title,
      emailSubject: `[OneSource e-Memo] ${params.title}`,
      message: params.message,
      bodyHtml: `<p>${params.message}</p>`,
    };

    const result = await sendMemoEmailToUser({
      userId: params.userId,
      memoId: params.memoId,
      emailSubject: copy.emailSubject,
      title: copy.title,
      bodyHtml: copy.bodyHtml,
      highlightText: copy.highlightText,
      highlightSubtext: copy.highlightSubtext,
      bullets: copy.bullets,
      ctaLabel: 'Review memo',
      footerNote: 'You are receiving this because you are involved in the memo approval workflow.',
    });

    if (result.sent && notificationId) {
      await supabase.from('notifications').update({ email_sent: true }).eq('id', notificationId);
    }
  }
}

/** Everyone who signed or approved on the memo (creator + each workflow step). */
export async function fetchMemoApprovalTrailUserIds(memoId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const ids = new Set<string>();

  const [{ data: signatures }, { data: excoApprovals }] = await Promise.all([
    supabase.from('signature_records').select('approver_id').eq('memo_id', memoId),
    supabase
      .from('exco_approvals')
      .select('approver_id')
      .eq('memo_id', memoId)
      .eq('action', 'approve'),
  ]);

  for (const row of signatures || []) {
    if (row.approver_id) ids.add(row.approver_id);
  }
  for (const row of excoApprovals || []) {
    if (row.approver_id) ids.add(row.approver_id);
  }

  return [...ids];
}

export async function notifyApprovers(
  approverIds: string[],
  memoId: string,
  context: MemoNotificationContext,
  type: NotificationEvent = 'memo_routed'
) {
  const uniqueIds = [...new Set(approverIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    console.warn(`No approvers found for memo ${context.referenceNumber} (${type})`);
    return;
  }

  const copy = EVENT_COPY[type] || EVENT_COPY.memo_routed!;
  const channelFlags = await loadNotificationChannelFlags(type);

  await Promise.all(
    uniqueIds.map(async (approverId) => {
      const content = copy(context);
      await sendNotification({
        userId: approverId,
        memoId,
        title: content.title,
        message: content.message,
        type,
        context,
        channelFlags,
      });
    })
  );
}

export async function fetchMemoNotificationContext(
  memoId: string
): Promise<MemoNotificationContext & { creatorId: string }> {
  const supabase = createServiceClient();
  const { data: memo } = await supabase
    .from('memos')
    .select('reference_number, subject, memo_from, creator_id, creator:users!creator_id(full_name)')
    .eq('id', memoId)
    .single();

  if (!memo) {
    return { referenceNumber: memoId, creatorId: '' };
  }

  const creator = memo.creator as { full_name?: string } | null;

  return {
    referenceNumber: memo.reference_number,
    subject: memo.subject,
    memoFrom: memo.memo_from,
    creatorId: memo.creator_id,
    actorName: creator?.full_name,
  };
}

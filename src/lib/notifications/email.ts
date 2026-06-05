import { createServiceClient } from '@/lib/supabase/server';
import { buildBrandedEmailHtml, type EmailPayload } from './emailTemplate';
import {
  buildInboxHeaders,
  buildMessageId,
  buildPlainTextBody,
  envelopeFromAddress,
  INLINE_HERO_CID,
  INLINE_LOGO_CID,
  loadInlineImageAttachments,
  parseSmtpFrom,
} from './emailDelivery';

export type { EmailPayload };

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export function buildMemoEmailHtml(payload: EmailPayload): string {
  return buildBrandedEmailHtml(payload, appBaseUrl(), {
    logoCid: INLINE_LOGO_CID,
    heroCid: INLINE_HERO_CID,
  });
}

type MailTransporter = {
  sendMail: (options: Record<string, unknown>) => Promise<unknown>;
};

let cachedTransporter: MailTransporter | null = null;
let cachedInlineAttachments: Awaited<ReturnType<typeof loadInlineImageAttachments>> | null =
  null;

async function getMailTransporter(): Promise<MailTransporter | null> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  if (!cachedTransporter) {
    const nodemailer = await import('nodemailer');
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    }) as MailTransporter;
  }

  return cachedTransporter;
}

async function getInlineAttachments() {
  if (!cachedInlineAttachments) {
    cachedInlineAttachments = await loadInlineImageAttachments();
  }
  return cachedInlineAttachments;
}

export async function sendTransactionalEmail(
  payload: EmailPayload,
  options?: { appUrl?: string }
): Promise<{ sent: boolean; reason?: string }> {
  if (!payload.to) return { sent: false, reason: 'no_recipient' };

  const transporter = await getMailTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[email:dev] Would send email', {
        to: payload.to,
        subject: payload.subject,
        title: payload.title,
        ctaUrl: payload.ctaUrl,
      });
    }
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    const baseUrl = options?.appUrl?.replace(/\/$/, '') || appBaseUrl();
    const from = parseSmtpFrom();
    const fromDomain = from.address.split('@')[1] || 'rukapay.co.ug';
    const messageId = buildMessageId(fromDomain);
    const inlineAttachments = await getInlineAttachments();
    const html = buildBrandedEmailHtml(
      payload,
      baseUrl,
      inlineAttachments.length
        ? { logoCid: INLINE_LOGO_CID, heroCid: INLINE_HERO_CID }
        : undefined
    );

    await transporter.sendMail({
      from: from.formatted,
      to: payload.to,
      replyTo: process.env.SMTP_REPLY_TO?.trim() || 'support@rukapay.co.ug',
      envelope: {
        from: envelopeFromAddress(),
        to: payload.to,
      },
      subject: payload.subject,
      messageId,
      headers: buildInboxHeaders({
        to: payload.to,
        subject: payload.subject,
        messageId,
        fromDomain,
      }),
      html,
      text: buildPlainTextBody(payload),
      attachments: inlineAttachments,
    });

    return { sent: true };
  } catch (err) {
    console.error('Email send failed:', err);
    return { sent: false, reason: err instanceof Error ? err.message : 'send_failed' };
  }
}

export async function sendPasswordResetEmail(params: {
  email: string;
  fullName: string;
  resetUrl: string;
  appUrl?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const portalUrl = params.appUrl?.replace(/\/$/, '') || appBaseUrl();

  return sendTransactionalEmail(
    {
      to: params.email,
      toName: params.fullName,
      subject: 'Reset your RukaPay e-Memo password',
      title: 'Password reset',
      body: `<p style="margin:0;">
        We received a request to reset the password for your <strong>RukaPay e-Memo</strong> account.
        Use the button below to choose a new password. This link is valid for a limited time.
      </p>`,
      highlightText: 'Reset your password',
      highlightSubtext: 'For your security, this link expires after one use.',
      bullets: [
        'If you did not request a password reset, you can safely ignore this email.',
        'Never share your password or this reset link with anyone.',
        'This is an automated message from RukaPay e-Memo.',
        'For help, contact support@rukapay.co.ug or your system administrator.',
      ],
      ctaLabel: 'Reset password',
      ctaUrl: params.resetUrl,
      footerNote:
        'This is an automated message from RukaPay e-Memo. Please do not reply to this email.',
    },
    { appUrl: portalUrl }
  );
}

export async function sendWelcomeSignInEmail(params: {
  email: string;
  fullName: string;
  roleName?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const dashboardUrl = appBaseUrl();
  const roleNote = params.roleName ? ` Assigned role: ${params.roleName}.` : '';

  return sendTransactionalEmail({
    to: params.email,
    toName: params.fullName,
    subject: 'Your RukaPay e-Memo account is ready',
    title: 'Welcome to the paperless era',
    body: `<p style="margin:0;">
        You have successfully signed in to the <strong>RukaPay e-Memo System</strong>.
        Please use the portal link below to create, route, and approve internal memos digitally.${roleNote}
      </p>`,
    highlightText: 'Welcome to the paperless era',
    highlightSubtext: 'Your secure digital memo workspace is ready.',
    bullets: [
      'Create and submit memos for approval through your department workflow.',
      'Track status, comments, and approvals in real time from any device.',
      'Export approved memos as a watermarked PDF (E-Copy) when processing is complete.',
      'Please do not share your login credentials with anyone.',
      'This is an automated message — please do not reply to this email.',
      'For access issues, contact your system administrator or support@rukapay.co.ug.',
    ],
    ctaLabel: 'Open e-Memo portal',
    ctaUrl: dashboardUrl,
    footerNote:
      'This welcome message is sent once after your first successful sign-in.',
  });
}

/** Send welcome email once per user (no-op if already sent or SMTP unavailable). */
export async function sendWelcomeSignInEmailOnce(
  userId: string
): Promise<{ sent: boolean; reason?: string; skipped?: boolean }> {
  const supabase = createServiceClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, must_set_password, roles(name)')
    .eq('id', userId)
    .single();

  if (error || !user?.email) {
    console.warn('[email] welcome skipped — user lookup failed', { userId, error: error?.message });
    return { sent: false, reason: 'user_lookup_failed' };
  }

  if (user.must_set_password) {
    console.info('[email] welcome skipped — password not set yet', { userId, email: user.email });
    return { sent: false, skipped: true, reason: 'must_set_password' };
  }

  const { data: sentRow, error: sentCheckError } = await supabase
    .from('users')
    .select('welcome_email_sent_at')
    .eq('id', userId)
    .maybeSingle();

  if (!sentCheckError && sentRow?.welcome_email_sent_at) {
    return { sent: false, skipped: true, reason: 'already_sent' };
  }

  const roles = user.roles as { name?: string } | null;
  const result = await sendWelcomeSignInEmail({
    email: user.email,
    fullName: user.full_name || 'Colleague',
    roleName: roles?.name,
  });

  if (!result.sent) {
    console.warn('[email] welcome not sent', { userId, email: user.email, reason: result.reason });
    return { sent: false, reason: result.reason };
  }

  console.info('[email] welcome sent', { userId, email: user.email });

  const { error: updateError } = await supabase
    .from('users')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateError?.message?.includes('welcome_email_sent_at')) {
    console.warn('[email] welcome_email_sent_at column missing — run migration 003_welcome_email_sent.sql');
  }

  return { sent: true };
}

/** Clear welcome flag and send again (admin/support). */
export async function resendWelcomeSignInEmail(userId: string): Promise<{ sent: boolean; reason?: string }> {
  const supabase = createServiceClient();
  await supabase.from('users').update({ welcome_email_sent_at: null }).eq('id', userId);
  const result = await sendWelcomeSignInEmailOnce(userId);
  return { sent: result.sent, reason: result.reason };
}

export async function sendMemoEmailToUser(params: {
  userId: string;
  memoId?: string;
  emailSubject: string;
  title: string;
  bodyHtml: string;
  highlightText?: string;
  highlightSubtext?: string;
  bullets?: string[];
  ctaLabel?: string;
  footerNote?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', params.userId)
    .single();

  if (!user?.email) return { sent: false, reason: 'no_email' };

  const memoLink = params.memoId ? `${appBaseUrl()}/memos/${params.memoId}` : appBaseUrl();

  return sendTransactionalEmail({
    to: user.email,
    toName: user.full_name || 'Colleague',
    subject: params.emailSubject,
    title: params.title,
    body: params.bodyHtml,
    highlightText: params.highlightText || params.title,
    highlightSubtext: params.highlightSubtext,
    bullets: params.bullets ?? [
      'Please sign in to review and take action on this memo.',
      'Do not share approval links or credentials with others.',
      'This is an automated notification from RukaPay e-Memo.',
    ],
    ctaLabel: params.ctaLabel || 'Review memo',
    ctaUrl: memoLink,
    footerNote: params.footerNote,
  });
}

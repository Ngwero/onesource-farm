import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { EmailPayload } from './emailTemplate';

export const INLINE_LOGO_CID = 'logo@rukapay.co.ug';
export const INLINE_HERO_CID = 'hero@rukapay.co.ug';

export interface ParsedFrom {
  name: string;
  address: string;
  formatted: string;
}

export function parseSmtpFrom(): ParsedFrom {
  const raw = process.env.SMTP_FROM?.trim() || 'RukaPay e-Memo <noreply@rukapay.co.ug>';
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].replace(/^["']|["']$/g, '').trim(),
      address: match[2].trim().toLowerCase(),
      formatted: raw,
    };
  }
  return { name: 'RukaPay e-Memo', address: raw.toLowerCase(), formatted: raw };
}

/** Align envelope sender with authenticated SMTP user (helps SPF/DMARC pass). */
export function envelopeFromAddress(): string {
  const smtpUser = process.env.SMTP_USER?.trim().toLowerCase();
  const { address } = parseSmtpFrom();
  return smtpUser || address;
}

export function replyToAddress(): string {
  return process.env.SMTP_REPLY_TO?.trim() || 'support@rukapay.co.ug';
}

export function buildMessageId(fromDomain: string): string {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `<ememo.${stamp}.${rand}@${fromDomain}>`;
}

/** Headers that signal transactional mail (not marketing/bulk) to Outlook and other clients. */
export function buildInboxHeaders(options: {
  to: string;
  subject: string;
  messageId: string;
  fromDomain: string;
}): Record<string, string> {
  return {
    'Message-ID': options.messageId,
    'Reply-To': replyToAddress(),
    'X-Mailer': 'RukaPay e-Memo',
    Importance: 'normal',
    'X-Priority': '3',
    'X-MSMail-Priority': 'Normal',
    'Auto-Submitted': 'auto-generated',
    'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
    'X-Entity-Ref-ID': options.messageId.replace(/[<>]/g, ''),
    'X-Email-Type': 'transactional',
  };
}

export async function loadInlineImageAttachments(): Promise<
  Array<{ filename: string; content: Buffer; cid: string; contentDisposition: 'inline' }>
> {
  const publicDir = join(process.cwd(), 'public');
  const items: Array<{ file: string; cid: string }> = [
    { file: 'rukapay-logo-white.png', cid: INLINE_LOGO_CID },
    { file: 'email-hero.png', cid: INLINE_HERO_CID },
  ];

  const attachments: Array<{
    filename: string;
    content: Buffer;
    cid: string;
    contentDisposition: 'inline';
  }> = [];

  for (const { file, cid } of items) {
    const path = join(publicDir, file);
    if (!existsSync(path)) continue;
    const content = await readFile(path);
    attachments.push({
      filename: file,
      content,
      cid,
      contentDisposition: 'inline',
    });
  }

  return attachments;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildPlainTextBody(payload: EmailPayload): string {
  const plainBullets = payload.bullets?.length
    ? payload.bullets
        .map((b, i) => `${String.fromCharCode(97 + i)}. ${stripHtml(b)}`)
        .join('\n')
    : '';

  const lines = [
    `Hi ${payload.toName},`,
    '',
    stripHtml(payload.body),
    '',
    payload.highlightText || payload.title,
    payload.highlightSubtext ? stripHtml(payload.highlightSubtext) : '',
    '',
    plainBullets,
    '',
    payload.ctaUrl ? `${payload.ctaLabel || 'Open'}: ${payload.ctaUrl}` : '',
    payload.footerNote ? stripHtml(payload.footerNote) : '',
    '',
    'Regards,',
    'RukaPay e-Memo',
    'Rhino Payment Services Limited',
    '',
    `Questions: ${replyToAddress()}`,
  ];

  return lines.filter((line) => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
}

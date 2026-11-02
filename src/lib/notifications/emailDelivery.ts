import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { EmailPayload } from './emailTemplate';

export const INLINE_LOGO_CID = 'logo@onesourcefresh.com';
export const INLINE_HERO_CID = 'hero@onesourcefresh.com';

export interface ParsedFrom {
  name: string;
  address: string;
  formatted: string;
}

export function parseSmtpFrom(): ParsedFrom {
  const raw = process.env.SMTP_FROM?.trim() || 'OneSource Farm <noreply@onesourcefresh.com>';
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].replace(/^["']|["']$/g, '').trim(),
      address: match[2].trim().toLowerCase(),
      formatted: raw,
    };
  }
  return { name: 'OneSource Farm', address: raw.toLowerCase(), formatted: raw };
}

/** Align envelope sender with authenticated SMTP user (helps SPF/DMARC pass). */
export function envelopeFromAddress(): string {
  const smtpUser = process.env.SMTP_USER?.trim().toLowerCase();
  const { address } = parseSmtpFrom();
  return smtpUser || address;
}

export function replyToAddress(): string {
  return process.env.SMTP_REPLY_TO?.trim() || 'your system administrator';
}

export function buildMessageId(fromDomain: string): string {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `<onesource-farm.${stamp}.${rand}@${fromDomain}>`;
}

/**
 * Headers tuned for Outlook Focused / primary inbox (not Other or Junk).
 * Avoid Auto-Submitted and bulk signals — those often land in Other for M365.
 */
export function buildInboxHeaders(options: {
  to: string;
  subject: string;
  messageId: string;
  fromDomain: string;
}): Record<string, string> {
  const refId = options.messageId.replace(/[<>]/g, '');
  return {
    'Message-ID': options.messageId,
    'Reply-To': replyToAddress(),
    'Content-Language': 'en',
    Importance: 'normal',
    'X-Priority': '3',
    'X-MSMail-Priority': 'Normal',
    Precedence: 'normal',
    'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
    'X-Entity-Ref-ID': refId,
  };
}

export async function loadInlineImageAttachments(): Promise<
  Array<{ filename: string; content: Buffer; cid: string; contentDisposition: 'inline' }>
> {
  const publicDir = join(process.cwd(), 'public');
  const items: Array<{ file: string; cid: string }> = [
    { file: 'onesource-logo-white.png', cid: INLINE_LOGO_CID },
    { file: 'email-hero.jpg', cid: INLINE_HERO_CID },
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
    'OneSource Farm',
    'OneSource Farm',
    '',
    `Questions: ${replyToAddress()}`,
  ];

  return lines.filter((line) => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
}

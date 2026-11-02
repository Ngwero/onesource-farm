import { createServiceClient } from '@/lib/supabase/server';
import {
  sendSystemLaunchEmail,
  SYSTEM_LAUNCH_EFFECTIVE_DATE,
  SYSTEM_LAUNCH_TEMP_PASSWORD,
} from './email';

export interface LaunchAnnouncementPreview {
  portalUrl: string;
  effectiveDate: string;
  temporaryPassword: string;
  subject: string;
  recipientCount: number;
  recipients: Array<{ email: string; full_name: string }>;
  smtpConfigured: boolean;
}

export async function getLaunchAnnouncementPreview(
  portalUrl: string,
  testEmail?: string
): Promise<LaunchAnnouncementPreview> {
  const supabase = createServiceClient();
  let query = supabase
    .from('users')
    .select('email, full_name')
    .eq('is_active', true)
    .order('email');

  if (testEmail) {
    query = query.eq('email', testEmail.trim().toLowerCase());
  }

  const { data: users, error } = await query;
  if (error) throw error;

  return {
    portalUrl,
    effectiveDate: SYSTEM_LAUNCH_EFFECTIVE_DATE,
    temporaryPassword: SYSTEM_LAUNCH_TEMP_PASSWORD,
    subject: 'OneSource Farm is live — please sign in before Monday 8 June',
    recipientCount: users?.length ?? 0,
    recipients: (users ?? []).map((u) => ({
      email: u.email,
      full_name: u.full_name,
    })),
    smtpConfigured: Boolean(process.env.SMTP_HOST?.trim()),
  };
}

export async function sendLaunchAnnouncementBatch(options: {
  portalUrl: string;
  testEmail?: string;
}): Promise<{
  sent: number;
  failed: number;
  total: number;
  failures: Array<{ email: string; reason?: string }>;
}> {
  const preview = await getLaunchAnnouncementPreview(options.portalUrl, options.testEmail);
  if (!preview.smtpConfigured) {
    throw new Error('SMTP is not configured on the server. Add SMTP_* environment variables.');
  }
  if (preview.recipientCount === 0) {
    throw new Error(options.testEmail ? 'No active user found for that email.' : 'No active users to email.');
  }

  let sent = 0;
  let failed = 0;
  const failures: Array<{ email: string; reason?: string }> = [];

  for (const user of preview.recipients) {
    const result = await sendSystemLaunchEmail({
      email: user.email,
      fullName: user.full_name || 'Colleague',
      appUrl: options.portalUrl,
    });

    if (result.sent) {
      sent += 1;
    } else {
      failed += 1;
      failures.push({ email: user.email, reason: result.reason });
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return { sent, failed, total: preview.recipientCount, failures };
}

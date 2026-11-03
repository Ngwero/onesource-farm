import type { Permission } from '@/lib/farm/permissions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTransactionalEmail } from '@/lib/notifications/email';
import { normalizeUserProfile } from '@/lib/auth/profile';
import { getFarmAccess } from '@/lib/farm/access';
import { buildReportCsv, canExportReport, isReportType } from '@/lib/farm/reports';

export type DigestSubscription = {
  id: string;
  farm_id: string;
  user_id: string;
  email: string;
  report_types: string[];
  cadence: 'daily' | 'weekly';
  weekday: number;
  hour_utc: number;
  is_active: boolean;
  last_sent_at: string | null;
  updated_at?: string;
};

export function shouldSendNow(sub: DigestSubscription, now = new Date()): boolean {
  if (!sub.is_active) return false;
  if (now.getUTCHours() !== sub.hour_utc) return false;
  if (sub.cadence === 'weekly' && now.getUTCDay() !== sub.weekday) return false;
  if (sub.last_sent_at) {
    const last = new Date(sub.last_sent_at);
    if (last.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) return false;
  }
  return true;
}

export async function processFarmReportDigests(supabase: SupabaseClient): Promise<{
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const { data: enabled, error: settingsError } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'reports.digest_enabled')
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (enabled && String(enabled.value).toLowerCase() === 'false') {
    return { checked: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const { data: subs, error } = await supabase
    .from('report_digest_subscriptions')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;

  const now = new Date();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const rows = (subs ?? []) as DigestSubscription[];

  for (const sub of rows) {
    if (!shouldSendNow(sub, now)) {
      skipped += 1;
      continue;
    }

    // Conditional update is an atomic lease shared by all cron invocations.
    const claimAt = new Date().toISOString();
    const expired = new Date(Date.now() - 15 * 60_000).toISOString();
    let claim = supabase.from('report_digest_subscriptions')
      .update({ sending_started_at: claimAt })
      .eq('id', sub.id).eq('is_active', true)
      .or(`sending_started_at.is.null,sending_started_at.lt.${expired}`);
    if (sub.updated_at) claim = claim.eq('updated_at', sub.updated_at);
    claim = sub.last_sent_at ? claim.eq('last_sent_at', sub.last_sent_at) : claim.is('last_sent_at', null);
    const { data: claimed, error: claimError } = await claim.select('id').maybeSingle();
    if (claimError) { failed += 1; continue; }
    if (!claimed) { skipped += 1; continue; }

    try {
      const { data: profile, error: profileError } = await supabase.from('users')
        .select('*, roles(slug, name), departments(name, code)')
        .eq('id', sub.user_id).eq('is_active', true).maybeSingle();
      if (profileError) throw profileError;
      const user = normalizeUserProfile(profile);
      if (!user) { skipped += 1; continue; }
      const access = await getFarmAccess(user);
      const can = (permission: Permission) => access.permissions.includes(permission);
      const types = sub.report_types.filter(isReportType).filter((type) => canExportReport(type, can));
      if (!types.length) { skipped += 1; continue; }
      const sections: string[] = [];
      for (const type of types) {
        const { csv, filename } = await buildReportCsv(supabase, sub.farm_id, type, can);
        sections.push(`--- ${type.toUpperCase()} (${filename}) ---\n${csv}`);
      }

      const portal = process.env.NEXT_PUBLIC_APP_URL || 'https://onesource-farm.vercel.app';
      const escaped = sections
        .join('\n\n')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const result = await sendTransactionalEmail({
        to: sub.email,
        toName: sub.email.split('@')[0] || 'Team',
        subject: `OneSource Farm ${sub.cadence} report digest`,
        title: 'Scheduled farm report',
        body: `<p>Your ${sub.cadence} farm digest is ready. Open the portal for live dashboards, or review the CSV summaries below.</p>
<pre style="white-space:pre-wrap;font-size:12px;background:#f4f6f8;padding:12px;border-radius:8px;">${escaped}</pre>`,
        ctaLabel: 'Open portal',
        ctaUrl: `${portal}/reports`,
        highlightText: `${types.length} report${types.length === 1 ? '' : 's'}`,
        highlightSubtext: types.join(', '),
      });

      if (!result.sent) throw new Error(result.reason || 'email_failed');

      const { error: sentError } = await supabase
        .from('report_digest_subscriptions')
        .update({ last_sent_at: now.toISOString() })
        .eq('id', sub.id).eq('sending_started_at', claimAt);
      if (sentError) throw sentError;
      sent += 1;
    } catch (error) {
      console.error('Farm digest delivery failed', { subscriptionId: sub.id, error });
      failed += 1;
    } finally {
      const { error: releaseError } = await supabase.from('report_digest_subscriptions')
        .update({ sending_started_at: null }).eq('id', sub.id).eq('sending_started_at', claimAt);
      if (releaseError) console.error('Farm digest lease release failed', { subscriptionId: sub.id, error: releaseError });
    }
  }

  return { checked: rows.length, sent, failed, skipped };
}

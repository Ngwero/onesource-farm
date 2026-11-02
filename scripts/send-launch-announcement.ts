/**
 * Send the go-live announcement to all active staff.
 *
 * Usage:
 *   npm run send:launch              # preview recipients (dry run)
 *   npm run send:launch -- --send    # send to everyone
 *   npm run send:launch -- you@email.com --send   # test one address first
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';
import { resolveLaunchEmailAppUrl } from '../src/lib/auth/appUrl';
import {
  SYSTEM_LAUNCH_EFFECTIVE_DATE,
  SYSTEM_LAUNCH_TEMP_PASSWORD,
} from '../src/lib/notifications/email';
import { sendLaunchAnnouncementBatch } from '../src/lib/notifications/launchAnnouncement';

loadEnvLocal();

const args = process.argv.slice(2);
const doSend = args.includes('--send');
const onlyEmail = args.find((a) => a.includes('@'))?.trim().toLowerCase();

async function main() {
  const { url, serviceKey } = requireSupabaseEnv();
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const appUrl = resolveLaunchEmailAppUrl();
  const smtpHost = process.env.SMTP_HOST?.trim();

  console.log('\n── OneSource Farm launch announcement ──');
  console.log(`  Portal:           ${appUrl}`);
  console.log(`  Go-live:          ${SYSTEM_LAUNCH_EFFECTIVE_DATE}`);
  console.log(`  Temp password:    ${SYSTEM_LAUNCH_TEMP_PASSWORD}`);
  console.log(`  SMTP_HOST:        ${smtpHost || '(not set — will NOT send)'}`);
  console.log(`  Mode:             ${doSend ? 'SEND' : 'DRY RUN (add --send to deliver)'}`);

  if (!smtpHost) {
    console.error('\nConfigure SMTP_* in .env.local (or production env) before sending.\n');
    process.exit(1);
  }

  let query = supabase
    .from('users')
    .select('id, email, full_name')
    .eq('is_active', true)
    .order('email');

  if (onlyEmail) {
    query = query.eq('email', onlyEmail);
  }

  const { data: users, error } = await query;
  if (error) throw error;

  if (!users?.length) {
    console.error(onlyEmail ? `\nNo active user found for ${onlyEmail}\n` : '\nNo active users found.\n');
    process.exit(1);
  }

  console.log(`\n  Recipients: ${users.length}\n`);
  for (const u of users) {
    console.log(`  • ${u.full_name} <${u.email}>`);
  }

  if (!doSend) {
    console.log('\nDry run complete. To send:');
    if (onlyEmail) {
      console.log(`  npm run send:launch -- ${onlyEmail} --send\n`);
    } else {
      console.log('  npm run send:launch -- --send\n');
    }
    return;
  }

  console.log('\nSending…\n');
  const result = await sendLaunchAnnouncementBatch({
    portalUrl: appUrl,
    testEmail: onlyEmail,
  });

  for (const user of users) {
    const fail = result.failures.find((f) => f.email === user.email);
    console.log(fail ? `  ✗ ${user.email} — ${fail.reason || 'failed'}` : `  ✓ ${user.email}`);
  }

  console.log(`\nDone. Sent: ${result.sent}, failed: ${result.failed}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

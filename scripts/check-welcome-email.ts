/**
 * Check welcome-email status for a user and optionally resend.
 * Usage:
 *   npm run check:email -- rowena.turinawe@onesourcefresh.com
 *   npm run check:email -- rowena.turinawe@onesourcefresh.com --send
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvLocal();

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const trySend = process.argv.includes('--send');
  const resend = process.argv.includes('--resend');

  if (!email) {
    console.error('Usage: npm run check:email -- <email> [--send]');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('\n── SMTP configuration ──');
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  console.log(`  SMTP_HOST:     ${smtpHost || '(not set — emails will NOT send)'}`);
  console.log(`  SMTP_PORT:     ${process.env.SMTP_PORT || '587'}`);
  console.log(`  SMTP_USER:     ${smtpUser || '(not set)'}`);
  console.log(`  SMTP_PASS:     ${process.env.SMTP_PASS ? '***set***' : '(not set)'}`);
  console.log(`  SMTP_FROM:     ${process.env.SMTP_FROM || '(default)'}`);
  console.log(`  APP_URL:       ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`);
  console.log(`  NODE_ENV:      ${process.env.NODE_ENV || '(unset)'}`);

  if (!smtpHost) {
    console.log('\n⚠ Add SMTP_* vars to .env.local, then restart the server.\n');
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('\nMissing Supabase env in .env.local\n');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, must_set_password, welcome_email_sent_at, roles(name)')
    .eq('email', email)
    .single();

  console.log('\n── User profile ──');
  if (error || !user) {
    console.error(`  ✗ User not found: ${email}`);
    process.exit(1);
  }

  console.log(`  Name:                  ${user.full_name}`);
  console.log(`  must_set_password:     ${user.must_set_password}`);
  console.log(`  welcome_email_sent_at: ${user.welcome_email_sent_at || '(never sent / column empty)'}`);

  const roles = user.roles as { name?: string } | null;

  console.log('\n── When welcome email sends ──');
  if (user.must_set_password) {
    console.log('  ⏳ Not yet — user must finish set-password, then sign in again.');
    console.log('     Welcome email fires on the FIRST login after password is set.');
  } else if (user.welcome_email_sent_at) {
    console.log(`  ✓ Marked sent at ${user.welcome_email_sent_at}`);
    console.log('     Check inbox/spam for: Welcome to the paperless era — OneSource Farm');
  } else {
    console.log('  ⚠ Password is set but welcome_email_sent_at is empty.');
    console.log('     Either login has not completed since setup, SMTP failed, or');
    console.log('     migration 003_welcome_email_sent.sql was not applied.');
  }

  if (trySend || resend) {
    console.log(`\n── ${resend ? 'Resending' : 'Attempting send'} ──`);
    const { resendWelcomeSignInEmail, sendWelcomeSignInEmailOnce } = await import(
      '../src/lib/notifications/email'
    );
    const result = resend
      ? await resendWelcomeSignInEmail(user.id)
      : await sendWelcomeSignInEmailOnce(user.id);
    console.log(`  Result: sent=${result.sent}${result.reason ? `, reason=${result.reason}` : ''}`);
    if (result.sent) {
      console.log('  Check inbox and spam for: Welcome to the paperless era — OneSource Farm');
    }
  } else if (!user.welcome_email_sent_at && !user.must_set_password && smtpHost) {
    console.log('\n  Tip: run with --send or --resend:');
    console.log(`  npm run check:email -- ${email} --send`);
    console.log(`  npm run check:email -- ${email} --resend`);
  } else if (user.welcome_email_sent_at && smtpHost) {
    console.log('\n  Already marked sent. To resend:');
    console.log(`  npm run check:email -- ${email} --resend`);
  }

  const { data: allUsers } = await supabase
    .from('users')
    .select('email, must_set_password, welcome_email_sent_at')
    .order('email');

  if (allUsers?.length) {
    console.log('── All team accounts ──');
    for (const u of allUsers) {
      const flag = u.must_set_password ? 'needs password' : u.welcome_email_sent_at ? 'welcome sent' : 'ready, no welcome yet';
      console.log(`  ${u.email}: ${flag}`);
    }
  }

  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

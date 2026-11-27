/**
 * Send Emma the account-login style email without resetting her password.
 *   npx tsx scripts/send-emma-login-email.ts
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const email = 'engwero@gmail.com';
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, title, roles(name)')
    .eq('email', email)
    .single();
  if (error || !user) throw error ?? new Error('Emma not found');

  const portalUrl = (
    process.env.LAUNCH_EMAIL_APP_URL ||
    process.env.EMAIL_APP_URL ||
    'https://onesourcefresh.com'
  ).replace(/\/$/, '');
  const loginUrl = `${portalUrl}/login`;
  const roleName =
    (user as { roles?: { name?: string } | null }).roles?.name ||
    user.title ||
    'System Administrator';

  const { sendTransactionalEmail } = await import('../src/lib/notifications/email');

  // Intentionally no auth.admin.updateUserById — password stays as-is.
  const result = await sendTransactionalEmail(
    {
      to: user.email,
      toName: user.full_name || 'Emma',
      subject: 'Your OneSource Farm account login',
      title: 'Your account is ready',
      body: `<p style="margin:0;">
        Your <strong>OneSource Farm</strong> account is ready. Assigned role: ${roleName}.
        Sign in with your email and your existing password — your password has not been changed.
      </p>`,
      highlightText: user.email,
      highlightSubtext: 'Use your existing password',
      bullets: [
        `Portal: <strong>${loginUrl}</strong>`,
        `Email: <strong>${user.email}</strong>`,
        'Password: <strong>your existing password</strong> (unchanged)',
        'Open Farm Overview after sign-in for weather, blocks, harvests, quality, workforce, and sales.',
        'Need help? Contact your system administrator.',
      ],
      ctaLabel: 'Open the portal',
      ctaUrl: loginUrl,
      footerNote: 'This is an automated message from OneSource Farm. Please do not reply to this email.',
    },
    { appUrl: portalUrl }
  );

  console.log({
    email: user.email,
    fullName: user.full_name,
    roleName,
    portalUrl,
    passwordChanged: false,
    sent: result.sent,
    reason: result.reason,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

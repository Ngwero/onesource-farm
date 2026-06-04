/**
 * Reset a user so they can go through first-login password setup again.
 * Usage: npm run reset:user -- rowena.turinawe@rukapay.co.ug
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

const INITIAL_PASSWORD = process.env.TEAM_INITIAL_PASSWORD || 'Welcome@RukaPay2026';

async function main() {
  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error('Usage: npm run reset:user -- <email>');
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, full_name, must_set_password')
    .eq('email', email)
    .single();

  if (profileError || !profile) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, {
    password: INITIAL_PASSWORD,
  });

  if (authError) {
    console.error(`Auth reset failed: ${authError.message}`);
    process.exit(1);
  }

  let { error: updateError } = await supabase
    .from('users')
    .update({ must_set_password: true, welcome_email_sent_at: null })
    .eq('id', profile.id);

  if (updateError?.message?.includes('welcome_email_sent_at')) {
    ({ error: updateError } = await supabase
      .from('users')
      .update({ must_set_password: true })
      .eq('id', profile.id));
  }

  if (updateError) {
    console.error(`Profile update failed: ${updateError.message}`);
    process.exit(1);
  }

  console.log(`✓ Reset onboarding for ${profile.full_name} (${email})`);
  console.log(`  Temporary password: ${INITIAL_PASSWORD}`);
  console.log('  They should sign in, then set a new password on the next screen.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

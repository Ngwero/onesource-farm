/**
 * Seed RukaPay team accounts.
 * Run after migrations + seed.sql:
 *   npm run seed:team
 *
 * First login: email + temporary password (printed below).
 * Users must set a new password on first sign-in.
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Shared password for first login (or permanent test password when TEST_UNIFIED_PASSWORD is set). */
const INITIAL_PASSWORD =
  process.env.TEST_UNIFIED_PASSWORD ||
  process.env.TEAM_INITIAL_PASSWORD ||
  'Welcome@RukaPay2026';
const SKIP_PASSWORD_SETUP = Boolean(process.env.TEST_UNIFIED_PASSWORD);

const TEAM_EMAILS = [
  'allan.kankiriho@rukapay.co.ug',
  'amara.oto@rukapay.co.ug',
  'ashiraf.kaweesi@rukapay.co.ug',
  'christine.kangume@rukapay.co.ug',
  'doreen.kembabazi@rukapay.co.ug',
  'doreen.nalwooga@rukapay.co.ug',
  'dorothy.kubakurungi@rukapay.co.ug',
  'emmanuel.ngwero@rukapay.co.ug',
  'gerald.naluja@rukapay.co.ug',
  'jason.ishiimwe@rukapay.co.ug',
  'jim.ntare@rukapay.co.ug',
  'margaret.nassiwa@rukapay.co.ug',
  'micheal.osiaga@rukapay.co.ug',
  'mutorine.silas@rukapay.co.ug',
  'ngabo.sevelin@rukapay.co.ug',
  'norman.nowamani@rukapay.co.ug',
  'portia.nayebare@rukapay.co.ug',
  'rowena.turinawe@rukapay.co.ug',
  'douglasrk@rukapay.co.ug',
];

/** System admin — full access; assign departments and roles for everyone else. */
const ADMIN_EMAIL = 'emmanuel.ngwero@rukapay.co.ug';

/** Finance dept memo creator + HR/marketing finance-step reviewer (Christine). */
const FINANCE_MEMO_CREATOR_EMAIL = 'christine.kangume@rukapay.co.ug';
/** Finance Request first approver (Amara). */
const FINANCE_MEMO_APPROVER_EMAIL = 'amara.oto@rukapay.co.ug';

/** HR staff who creates HR memos (Dorothy). */
const HR_MEMO_CREATOR_EMAIL = 'dorothy.kubakurungi@rukapay.co.ug';

/** IT 1st checker = admin (Emma); role stays admin in DB. See src/lib/workflow/itCheckers.ts */
const IT_FIRST_CHECKER_EMAIL = ADMIN_EMAIL;
const IT_SECOND_CHECKER_EMAIL = 'jim.ntare@rukapay.co.ug';

/** Business Development staff (Silas). */
const BD_STAFF_EMAIL = 'mutorine.silas@rukapay.co.ug';

/** CEO — creates memos routed to the Chairman; approves all other memos at CEO step. */
const CEO_EMAIL = 'rowena.turinawe@rukapay.co.ug';

/** Chairman — approves memos created by the CEO (Rowena). */
const CHAIRMAN_EMAIL = 'douglasrk@rukapay.co.ug';

function fullNameFromEmail(email: string): string {
  const local = email.split('@')[0] || '';
  return local
    .split('.')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

async function seed() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error: colCheck } = await supabase.from('users').select('must_set_password').limit(1);
  if (colCheck?.message?.includes('must_set_password')) {
    console.error(
      'Missing column users.must_set_password.\n' +
        'Run this in Supabase → SQL Editor:\n\n' +
        '  ALTER TABLE users ADD COLUMN IF NOT EXISTS must_set_password BOOLEAN NOT NULL DEFAULT FALSE;\n'
    );
    process.exit(1);
  }

  const { data: roles } = await supabase.from('roles').select('id, slug');
  const staffRoleId = roles?.find((r) => r.slug === 'staff')?.id;
  const deptHeadRoleId = roles?.find((r) => r.slug === 'department_head')?.id;
  const adminRoleId = roles?.find((r) => r.slug === 'admin')?.id;
  const financeRoleId = roles?.find((r) => r.slug === 'finance_reviewer')?.id;
  const itCheckerFirstRoleId = roles?.find((r) => r.slug === 'it_checker_first')?.id;
  const itCheckerSecondRoleId = roles?.find((r) => r.slug === 'it_checker_second')?.id;
  const ceoRoleId = roles?.find((r) => r.slug === 'ceo')?.id;

  const { data: financeDept } = await supabase
    .from('departments')
    .select('id')
    .eq('code', 'FIN')
    .single();

  const { data: itDept } = await supabase.from('departments').select('id').eq('code', 'IT').single();
  const { data: hrDept } = await supabase.from('departments').select('id').eq('code', 'HR').single();
  const { data: bdDept } = await supabase.from('departments').select('id').eq('code', 'BD').single();
  const { data: ceoDept } = await supabase.from('departments').select('id').eq('code', 'CEO').single();

  if (!staffRoleId || !adminRoleId) {
    console.error('Run supabase/seed.sql first (roles missing).');
    process.exit(1);
  }

  console.log(`Creating ${TEAM_EMAILS.length} team account(s)…\n`);

  for (const email of TEAM_EMAILS) {
    const full_name = fullNameFromEmail(email);
    const isAdmin = email === ADMIN_EMAIL;
    const isFinanceMemoCreator = email === FINANCE_MEMO_CREATOR_EMAIL;
    const isFinanceMemoApprover = email === FINANCE_MEMO_APPROVER_EMAIL;
    const isHrStaff = email === HR_MEMO_CREATOR_EMAIL;
    const isItCheckerFirst = !isAdmin && email === IT_FIRST_CHECKER_EMAIL;
    const isItCheckerSecond = !isAdmin && email === IT_SECOND_CHECKER_EMAIL;
    const isBdStaff = email === BD_STAFF_EMAIL;
    const isCeo = email === CEO_EMAIL;
    const isChairman = email === CHAIRMAN_EMAIL;
    const isFinanceReviewer = isFinanceMemoApprover || isFinanceMemoCreator;
    const role_id = isAdmin
      ? adminRoleId
      : (isCeo || isChairman) && ceoRoleId
        ? ceoRoleId
        : isHrStaff && deptHeadRoleId
        ? deptHeadRoleId
        : isFinanceMemoApprover && financeRoleId
          ? financeRoleId
          : isItCheckerFirst && itCheckerFirstRoleId
            ? itCheckerFirstRoleId
            : isItCheckerSecond && itCheckerSecondRoleId
              ? itCheckerSecondRoleId
              : staffRoleId;
    const department_id = isAdmin && itDept?.id
      ? itDept.id
      : (isCeo || isChairman) && ceoDept?.id
        ? ceoDept.id
        : (isFinanceMemoCreator || isFinanceMemoApprover) && financeDept?.id
        ? financeDept.id
        : isHrStaff && hrDept?.id
          ? hrDept.id
          : (isItCheckerFirst || isItCheckerSecond) && itDept?.id
            ? itDept.id
            : isBdStaff && bdDept?.id
              ? bdDept.id
              : null;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: INITIAL_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError && !authError.message.toLowerCase().includes('already')) {
      console.error(`✗ ${email}: ${authError.message}`);
      continue;
    }

    let userId = authData?.user?.id;
    let existingMustSetPassword: boolean | null = null;

    if (!userId) {
      const { data: existing } = await supabase
        .from('users')
        .select('id, must_set_password')
        .eq('email', email)
        .single();
      userId = existing?.id;
      existingMustSetPassword = existing?.must_set_password ?? null;
      if (userId) {
        await supabase.auth.admin.updateUserById(userId, { password: INITIAL_PASSWORD });
      }
    } else {
      const { data: existing } = await supabase
        .from('users')
        .select('must_set_password')
        .eq('id', userId)
        .maybeSingle();
      existingMustSetPassword = existing?.must_set_password ?? null;
    }

    if (!userId) {
      console.error(`✗ ${email}: could not resolve user id`);
      continue;
    }

    const { error: profileError } = await supabase.from('users').upsert({
      id: userId,
      email,
      full_name,
      title: isAdmin
        ? 'System Administrator & IT Checker (1st)'
        : isCeo
          ? 'Chief Executive Officer'
          : isChairman
            ? 'Chairman'
            : isFinanceReviewer
          ? 'Finance & HR Reviewer'
          : isHrStaff
            ? 'HR — Dept Head'
          : isItCheckerFirst
            ? 'IT Checker (1st)'
            : isItCheckerSecond
              ? 'IT Checker (2nd) — Jim'
              : isBdStaff
                ? 'Business Development — Staff'
                : full_name,
      role_id,
      department_id,
      is_active: true,
      // Keep false for users who already completed onboarding
      must_set_password: SKIP_PASSWORD_SETUP
        ? false
        : existingMustSetPassword === false
          ? false
          : true,
    });

    if (profileError) {
      console.error(`✗ ${email} profile: ${profileError.message}`);
      if (profileError.message.includes('must_set_password')) {
        console.error('  → Run supabase/migrations/002_user_must_set_password.sql in Supabase SQL editor.');
      }
      continue;
    }

    const roleLabel = isAdmin
      ? 'admin + memos'
      : isCeo
        ? 'CEO (creates memos → Chairman)'
        : isChairman
          ? 'Chairman (approves CEO memos)'
          : isFinanceReviewer
        ? 'finance reviewer (general memos + finance queue)'
        : isItCheckerFirst
          ? 'IT checker 1st'
          : isItCheckerSecond
            ? 'IT checker 2nd (Jim)'
            : 'staff (create memos)';
    console.log(`✓ ${email} — ${full_name} [${roleLabel}]`);
  }

  console.log('\n────────────────────────────────────────');
  if (SKIP_PASSWORD_SETUP) {
    console.log('Test mode (TEST_UNIFIED_PASSWORD): same password for every user, no set-password step.');
    console.log(`  Login password: ${INITIAL_PASSWORD}`);
  } else {
    console.log('First-time login for every user:');
    console.log(`  Temporary password: ${INITIAL_PASSWORD}`);
    console.log('  After sign-in, each user sets a new password (with confirmation).');
    console.log('  For one shared test password on all accounts: npm run test:password');
  }
  console.log(`\nAdmin (assign departments/roles): ${ADMIN_EMAIL}`);
  console.log('  Admin → Users → edit department & role for each person.');
  console.log('────────────────────────────────────────\n');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

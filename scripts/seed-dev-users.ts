/**
 * Development seed script for demo users.
 * Run after applying Supabase migrations and seed.sql:
 *   npm run seed:users
 *
 * Creates auth users and profiles for each role.
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

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Copy .env.example to .env.local and add your Supabase credentials.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const DEMO_USERS = [
  { email: 'admin@rukapay.com', password: 'Admin@123', full_name: 'System Admin', role: 'admin', dept: 'CEO' },
  { email: 'staff@rukapay.com', password: 'Staff@123', full_name: 'John Staff', role: 'staff', dept: 'IT' },
  { email: 'depthead@rukapay.com', password: 'Head@123', full_name: 'Sarah Dept Head', role: 'department_head', dept: 'IT' },
  { email: 'finance@rukapay.com', password: 'Finance@123', full_name: 'Peter Finance', role: 'finance_reviewer', dept: 'Finance' },
  { email: 'hr@rukapay.com', password: 'HR@123', full_name: 'Mary HR', role: 'hr_reviewer', dept: 'HR' },
  { email: 'ceo@rukapay.com', password: 'CEO@123', full_name: 'David CEO', role: 'ceo', dept: 'CEO' },
  { email: 'cbdo@rukapay.com', password: 'EXCO@123', full_name: 'James CBDO', role: 'exco_member', dept: 'BD', exco: 'CBDO' },
  { email: 'cto@rukapay.com', password: 'EXCO@123', full_name: 'Alice CTO', role: 'exco_member', dept: 'IT', exco: 'CTO' },
  { email: 'cfo@rukapay.com', password: 'EXCO@123', full_name: 'Robert CFO', role: 'exco_member', dept: 'Finance', exco: 'CFO' },
];

async function seed() {
  const { data: roles } = await supabase.from('roles').select('id, slug');
  const { data: departments } = await supabase.from('departments').select('id, code');

  const roleMap = Object.fromEntries((roles || []).map((r) => [r.slug, r.id]));
  const deptMap = Object.fromEntries((departments || []).map((d) => [d.code, d.id]));

  for (const user of DEMO_USERS) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (authError && !authError.message.includes('already')) {
      console.error(`Auth error for ${user.email}:`, authError.message);
      continue;
    }

    const userId = authData?.user?.id;
    if (!userId) {
      const { data: existing } = await supabase.from('users').select('id').eq('email', user.email).single();
      if (!existing) continue;
    }

    const id = userId || (await supabase.from('users').select('id').eq('email', user.email).single()).data?.id;
    if (!id) continue;

    await supabase.from('users').upsert({
      id,
      email: user.email,
      full_name: user.full_name,
      title: user.full_name,
      role_id: roleMap[user.role],
      department_id: deptMap[user.dept],
      is_active: true,
    });

    if (user.exco) {
      await supabase.from('exco_members').upsert({
        user_id: id,
        position: user.exco,
        is_active: true,
      });
    }

  // CEO is also EXCO
    if (user.role === 'ceo') {
      await supabase.from('exco_members').upsert({
        user_id: id,
        position: 'CEO',
        is_active: true,
      });
    }

    console.log(`✓ ${user.email} (${user.role})`);
  }

  console.log('\nDemo users seeded. Default password pattern: Role@123');
}

seed().catch(console.error);

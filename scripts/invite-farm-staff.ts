/**
 * Create farm staff accounts and email login details.
 *   npx tsx scripts/invite-farm-staff.ts
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

const PEOPLE = [
  {
    full_name: 'Sam Airo',
    email: 'samuelairo4@gmail.com',
    phone: '0794158627',
    title: 'Manager',
    farmRoleSlug: 'farm_manager',
    departmentCode: 'OPS',
  },
  {
    full_name: 'Alex Mulondo',
    email: 'mulondoalex26@gmail.com',
    phone: '0777344378',
    title: 'Agronomist',
    farmRoleSlug: 'field_supervisor',
    departmentCode: 'OPS',
  },
  {
    full_name: 'Kagoda Benard',
    email: 'kagodabenard2@gmail.com',
    phone: '0754418072',
    title: 'Agronomist',
    farmRoleSlug: 'field_supervisor',
    departmentCode: 'OPS',
  },
  {
    full_name: 'Kevin Amaniyo',
    email: 'kevinamaniyo00@gmail.com',
    phone: '0774526089',
    title: 'Agronomist',
    farmRoleSlug: 'field_supervisor',
    departmentCode: 'OPS',
  },
  {
    full_name: 'Sdaphy',
    email: 'sdaphy93@gmail.com',
    phone: '',
    title: 'Finance Manager',
    farmRoleSlug: 'finance_officer',
    departmentCode: 'FIN',
  },
] as const;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env in .env.local');
    process.exit(1);
  }

  const portalUrl = (
    process.env.LAUNCH_EMAIL_APP_URL ||
    process.env.EMAIL_APP_URL ||
    'https://onesourcefresh.com'
  ).replace(/\/$/, '');

  const { ONBOARDING_PASSWORD } = await import('../src/lib/admin/teamAuth');
  const { sendAccountLoginEmail } = await import('../src/lib/notifications/email');
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const password = ONBOARDING_PASSWORD;

  const { data: staffRole, error: roleErr } = await supabase
    .from('roles')
    .select('id, name')
    .eq('slug', 'staff')
    .single();
  if (roleErr || !staffRole) throw roleErr ?? new Error('staff role missing');

  const { data: depts } = await supabase.from('departments').select('id, code');
  const deptByCode = new Map((depts ?? []).map((d) => [d.code, d.id]));

  const { data: appRoles, error: appErr } = await supabase.from('app_roles').select('id, slug, name');
  if (appErr) throw appErr;
  const farmRoleBySlug = new Map((appRoles ?? []).map((r) => [r.slug, r]));

  console.log(`\nPortal: ${portalUrl}`);
  console.log(`Temp password: ${password}\n`);

  for (const person of PEOPLE) {
    const email = person.email.toLowerCase();
    const farmRole = farmRoleBySlug.get(person.farmRoleSlug);
    if (!farmRole) {
      console.error(`✗ ${email}: farm role ${person.farmRoleSlug} not found`);
      continue;
    }
    const departmentId = deptByCode.get(person.departmentCode) ?? null;
    const titleLabel = person.phone ? `${person.title} · ${person.phone}` : person.title;

    const { data: existing } = await supabase.from('users').select('id, email').eq('email', email).maybeSingle();
    let userId = existing?.id as string | undefined;

    if (userId) {
      console.log(`↻ ${person.full_name} already exists — resetting login & resending`);
      const { error: updAuth } = await supabase.auth.admin.updateUserById(userId, { password });
      if (updAuth) {
        console.error(`✗ ${email}: ${updAuth.message}`);
        continue;
      }
      await supabase
        .from('users')
        .update({
          full_name: person.full_name,
          title: titleLabel,
          department_id: departmentId,
          role_id: staffRole.id,
          must_set_password: true,
          welcome_email_sent_at: null,
          is_active: true,
        })
        .eq('id', userId);
    } else {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: person.full_name, phone: person.phone || undefined },
      });
      if (authError || !authUser.user) {
        console.error(`✗ ${email}: ${authError?.message || 'auth create failed'}`);
        continue;
      }
      userId = authUser.user.id;
      const { error: profileErr } = await supabase.from('users').insert({
        id: userId,
        email,
        full_name: person.full_name,
        title: titleLabel,
        department_id: departmentId,
        role_id: staffRole.id,
        is_active: true,
        must_set_password: true,
      });
      if (profileErr) {
        await supabase.auth.admin.deleteUser(userId);
        console.error(`✗ ${email}: ${profileErr.message}`);
        continue;
      }
      console.log(`✓ Created ${person.full_name} <${email}>`);
    }

    await supabase.from('user_app_roles').delete().eq('user_id', userId).eq('role_id', farmRole.id);
    const { error: linkErr } = await supabase.from('user_app_roles').insert({
      user_id: userId,
      role_id: farmRole.id,
    });
    if (linkErr && !/duplicate|unique/i.test(linkErr.message)) {
      console.warn(`  farm role warn: ${linkErr.message}`);
    } else {
      console.log(`  farm role: ${farmRole.name}`);
    }

    const result = await sendAccountLoginEmail({
      email,
      fullName: person.full_name,
      password,
      portalUrl,
      roleName: `${person.title} (${farmRole.name})`,
    });
    console.log(
      result.sent
        ? `  email sent → ${email}`
        : `  email NOT sent (${result.reason || 'unknown'}) — password is still ${password}`
    );
  }

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Recreate the first four business memos (RPS/EMEMO/2026/0001–0004).
 * Run: npm run seed:initial-memos
 * Replace if present: FORCE=1 npm run seed:initial-memos
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';

loadEnvLocal();

const YEAR = new Date().getFullYear();
const REFERENCES = [
  `RPS/EMEMO/${YEAR}/0001`,
  `RPS/EMEMO/${YEAR}/0002`,
  `RPS/EMEMO/${YEAR}/0003`,
  `RPS/EMEMO/${YEAR}/0004`,
];

const force = process.env.FORCE === '1';
const { url, serviceKey } = requireSupabaseEnv();
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type SeedMemo = {
  reference: string;
  memoType: string;
  creatorEmail: string;
  departmentCode: string;
  statusSlug: string;
  stepOrder: number;
  requiresFinance: boolean;
  subject: string;
  background: string;
  justification: string;
  recommendation: string;
  financialImplication?: string;
  memoTo?: string;
  daysAgoCreated: number;
};

const INITIAL_MEMOS: SeedMemo[] = [
  {
    reference: REFERENCES[0],
    memoType: 'general_internal',
    creatorEmail: 'ngabo.sevelin@onesourcefresh.com',
    departmentCode: 'IT',
    statusSlug: 'pending_department_head',
    stepOrder: 1,
    requiresFinance: true,
    subject: 'Internal policy update — remote access and device security',
    background:
      'IT is rolling out updated remote access controls and endpoint security standards for all staff using company devices.',
    justification:
      'Department heads must approve before circulation so each unit can align local practices with the new policy.',
    recommendation: 'Approve publication of the updated internal IT security policy to all departments.',
    daysAgoCreated: 6,
  },
  {
    reference: REFERENCES[1],
    memoType: 'it_request',
    creatorEmail: 'doreen.kembabazi@onesourcefresh.com',
    departmentCode: 'IT',
    statusSlug: 'pending_it_checker_first',
    stepOrder: 1,
    requiresFinance: true,
    subject: 'Procurement of developer laptops (Q2)',
    background:
      'The IT team requires additional laptops for new developers joining the payments platform squad.',
    financialImplication: 'UGX 18,500,000 (five units @ UGX 3,700,000 each)',
    justification:
      'Existing stock cannot cover the Q2 hiring plan; delays would block onboarding and delivery timelines.',
    recommendation:
      'Approve procurement of five standard developer laptops through the established IT vendor.',
    memoTo: 'CEO',
    daysAgoCreated: 5,
  },
  {
    reference: REFERENCES[2],
    memoType: 'hr_request',
    creatorEmail: 'dorothy.kubakurungi@onesourcefresh.com',
    departmentCode: 'HR',
    statusSlug: 'pending_finance',
    stepOrder: 1,
    requiresFinance: true,
    subject: 'HR training programme — compliance and onboarding (H1)',
    background:
      'HR proposes a structured compliance and onboarding programme for new hires and team leads in H1.',
    financialImplication: 'UGX 4,200,000',
    justification:
      'Regulatory and internal policy changes require refreshed training; external facilitator costs are included.',
    recommendation: 'Approve the H1 HR training budget and schedule.',
    daysAgoCreated: 4,
  },
  {
    reference: REFERENCES[3],
    memoType: 'finance_request',
    creatorEmail: 'christine.kangume@onesourcefresh.com',
    departmentCode: 'FIN',
    statusSlug: 'pending_ceo',
    stepOrder: 2,
    requiresFinance: true,
    subject: 'Quarterly statutory filings and audit support fees',
    background:
      'Finance requests approval for statutory filing and external audit support costs for the current quarter.',
    financialImplication: 'UGX 12,000,000',
    justification:
      'These fees are recurring statutory obligations; payment is due before the regulatory deadline.',
    recommendation: 'Approve release of funds for statutory filings and audit support.',
    daysAgoCreated: 3,
  },
];

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function memoFromLine(user: {
  full_name: string;
  title?: string | null;
  departments?: { code?: string } | { code?: string }[] | null;
}): string {
  const dept = Array.isArray(user.departments) ? user.departments[0] : user.departments;
  const code = dept?.code?.trim();
  const title = user.title?.trim();
  const name = user.full_name.trim();
  if (title && code) return `${name} | ${code}\n${title}`;
  if (code) return `${name} | ${code}`;
  return name;
}

async function lookupId(
  table: string,
  column: string,
  value: string
): Promise<string> {
  const { data, error } = await supabase.from(table).select('id').eq(column, value).single();
  if (error || !data?.id) throw new Error(`${table}.${column}=${value} not found`);
  return data.id as string;
}

async function lookupUser(email: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, title, email, departments(code)')
    .eq('email', email.toLowerCase())
    .single();
  if (error || !data?.id) throw new Error(`User not found: ${email}`);
  return data;
}

async function removeExistingInitialMemos() {
  const { data: existing } = await supabase
    .from('memos')
    .select('id, reference_number')
    .in('reference_number', REFERENCES);

  if (!existing?.length) return;

  const ids = existing.map((m) => m.id as string);
  const { error } = await supabase.from('memos').delete().in('id', ids);
  if (error) throw error;
  console.log(`  removed ${ids.length} existing initial memo(s)`);
}

async function seedInitialMemos() {
  console.log('Seeding initial business memos 0001–0004…\n');

  const { data: existing } = await supabase
    .from('memos')
    .select('reference_number')
    .in('reference_number', REFERENCES);

  if (existing?.length && !force) {
    console.log('Initial memos already exist:', existing.map((m) => m.reference_number).join(', '));
    console.log('Use FORCE=1 to replace them.');
    return;
  }

  if (existing?.length && force) {
    await removeExistingInitialMemos();
  }

  const { count: otherMemos } = await supabase
    .from('memos')
    .select('*', { count: 'exact', head: true });

  if ((otherMemos ?? 0) > 0 && !force) {
    console.warn(`Warning: ${otherMemos} other memo(s) exist. Only adding 0001–0004 if missing.`);
  }

  for (const spec of INITIAL_MEMOS) {
    const creator = await lookupUser(spec.creatorEmail);
    const departmentId = await lookupId('departments', 'code', spec.departmentCode);
    const memoTypeId = await lookupId('memo_types', 'slug', spec.memoType);
    const statusId = await lookupId('memo_statuses', 'slug', spec.statusSlug);

    const { data: workflow } = await supabase
      .from('approval_workflows')
      .select('id')
      .eq('memo_type_id', memoTypeId)
      .eq('is_default', true)
      .maybeSingle();

    const createdAt = daysAgoIso(spec.daysAgoCreated);
    const submittedAt = daysAgoIso(spec.daysAgoCreated - 1);
    const memoDate = submittedAt.split('T')[0];

    const { data: memo, error } = await supabase
      .from('memos')
      .insert({
        reference_number: spec.reference,
        memo_type_id: memoTypeId,
        status_id: statusId,
        creator_id: creator.id,
        department_id: departmentId,
        workflow_id: workflow?.id ?? null,
        current_version: 1,
        current_step_order: spec.stepOrder,
        memo_from: memoFromLine(creator),
        memo_to: spec.memoTo ?? 'CEO',
        memo_date: memoDate,
        subject: spec.subject,
        background: spec.background,
        financial_implication: spec.financialImplication ?? null,
        justification: spec.justification,
        recommendation: spec.recommendation,
        requires_finance: spec.requiresFinance,
        requires_exco: false,
        importance_level: 'normal',
        submitted_at: submittedAt,
        created_at: createdAt,
        updated_at: submittedAt,
      })
      .select('id, reference_number')
      .single();

    if (error) throw error;

    await supabase.from('memo_versions').insert({
      memo_id: memo.id,
      version_number: 1,
      subject: spec.subject,
      background: spec.background,
      financial_implication: spec.financialImplication ?? null,
      justification: spec.justification,
      recommendation: spec.recommendation,
      changed_by: creator.id,
      change_reason: 'Initial creation',
      created_at: createdAt,
    });

    await supabase.from('audit_logs').insert({
      memo_id: memo.id,
      user_id: creator.id,
      action: 'memo_created',
      new_values: { reference_number: spec.reference, seeded: true },
      created_at: createdAt,
    });

    await supabase.from('audit_logs').insert({
      memo_id: memo.id,
      user_id: creator.id,
      action: 'memo_submitted',
      new_values: { status: spec.statusSlug },
      created_at: submittedAt,
    });

    console.log(`  ✓ ${spec.reference} — ${spec.subject.slice(0, 50)}… (${spec.statusSlug})`);
  }

  const { error: seqError } = await supabase.from('memo_sequences').upsert(
    { year: YEAR, last_sequence: 4, updated_at: new Date().toISOString() },
    { onConflict: 'year' }
  );
  if (seqError) console.warn(`  memo_sequences: ${seqError.message}`);
  else console.log(`  memo_sequences: last_sequence set to 4 for ${YEAR}`);

  const { count } = await supabase.from('memos').select('*', { count: 'exact', head: true });
  console.log(`\nDone. Total memos in database: ${count ?? 0}`);
}

seedInitialMemos().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Seed land-preparation activity types (migration 030).
 *   npx tsx scripts/seed-land-preparation.ts
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

const TYPES = [
  {
    code: 'LAND_PREP',
    name: 'Land preparation',
    category: 'maintenance',
    uses_inputs: true,
    sort_order: 1,
    description: 'General land preparation before planting — clearing, tillage, beds, and soil work',
  },
  {
    code: 'CLEARING',
    name: 'Land clearing',
    category: 'maintenance',
    uses_inputs: true,
    sort_order: 2,
    description: 'Clearing bush, stubble, stones, or previous crop residue',
  },
  {
    code: 'TILLAGE',
    name: 'Tillage / ploughing',
    category: 'maintenance',
    uses_inputs: true,
    sort_order: 3,
    description: 'Ploughing, harrowing, or other soil tillage',
  },
  {
    code: 'BED_PREP',
    name: 'Bed preparation',
    category: 'maintenance',
    uses_inputs: true,
    sort_order: 4,
    description: 'Making planting beds, leveling, and layout',
  },
  {
    code: 'RIDGING',
    name: 'Ridging / furrowing',
    category: 'maintenance',
    uses_inputs: true,
    sort_order: 5,
    description: 'Forming ridges or furrows for planting and drainage',
  },
] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env in .env.local');
    process.exit(1);
  }
  const sb = createClient(url, key);

  for (const type of TYPES) {
    const { data: existing } = await sb.from('activity_types').select('id').eq('code', type.code).maybeSingle();
    if (existing) {
      const { error } = await sb
        .from('activity_types')
        .update({
          name: type.name,
          category: type.category,
          uses_inputs: type.uses_inputs,
          sort_order: type.sort_order,
          description: type.description,
          status: 'active',
        })
        .eq('id', existing.id);
      if (error) throw error;
      console.log(`↻ ${type.code} → ${type.name}`);
    } else {
      const { error } = await sb.from('activity_types').insert({ ...type, status: 'active' });
      if (error) throw error;
      console.log(`✓ ${type.code} → ${type.name}`);
    }
  }

  const { error: soilErr } = await sb
    .from('activity_types')
    .update({
      name: 'Soil amendment',
      sort_order: 6,
      description: 'Manure, compost, lime, or other soil amendments during land prep',
      status: 'active',
    })
    .eq('code', 'SOIL_WORK');
  if (soilErr) throw soilErr;
  console.log('↻ SOIL_WORK → Soil amendment');

  const { data } = await sb
    .from('activity_types')
    .select('code, name, sort_order, status')
    .in('code', [...TYPES.map((t) => t.code), 'SOIL_WORK'])
    .order('sort_order');
  console.log('\nLand prep types:');
  for (const row of data ?? []) console.log(`  ${row.sort_order}. ${row.code} — ${row.name}`);
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Seed crop catalog + varieties (migration 029).
 *   npx tsx scripts/seed-crop-catalog.ts
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

const QC_CRITERIA = [
  'Size',
  'Colour',
  'Weight',
  'Damage',
  'Defects',
  'Maturity',
  'Ripeness',
  'Pest signs',
  'Disease signs',
  'Moisture / condition',
  'Appearance',
] as const;

const CROPS = [
  {
    code: 'CHILLI',
    name: 'Chilies',
    scientific_name: 'Capsicum annuum / Capsicum spp.',
    production_cycle: 'seasonal',
    default_unit: 'kg',
    maturity_days: 90,
    description: 'Fresh chillies for export and local market',
    varieties: [
      { code: 'GREEN', name: 'Green Chilli', maturity_days: 90 },
      { code: 'RED', name: 'Red Chilli', maturity_days: 90 },
      { code: 'YELLOW', name: 'Yellow Chilli', maturity_days: 90 },
      { code: 'BIRDS-EYE', name: "Bird's Eye Chilli", maturity_days: 85 },
      { code: 'BULLET', name: 'Bullet Chilli', maturity_days: 90 },
      { code: 'CAYENNE', name: 'Cayenne Chilli', maturity_days: 95 },
      { code: 'THAI', name: 'Thai Chilli', maturity_days: 90 },
      { code: 'FINGER', name: 'Finger Chilli', maturity_days: 90 },
    ],
  },
  {
    code: 'HOTPEPPER',
    name: 'Hot Pepper',
    scientific_name: 'Capsicum chinense / Capsicum frutescens',
    production_cycle: 'seasonal',
    default_unit: 'kg',
    maturity_days: 100,
    description: 'Hot peppers for export and local market',
    varieties: [
      { code: 'SCOTCH-BONNET', name: 'Scotch Bonnet', maturity_days: 100 },
      { code: 'HABANERO', name: 'Habanero', maturity_days: 100 },
      { code: 'PIRI-PIRI', name: 'Piri Piri', maturity_days: 95 },
      { code: 'AFR-BIRDS-EYE', name: "African Bird's Eye Pepper", maturity_days: 90 },
      { code: 'RED-HOT', name: 'Red Hot Pepper', maturity_days: 95 },
      { code: 'YELLOW-HOT', name: 'Yellow Hot Pepper', maturity_days: 95 },
      { code: 'ORANGE-HAB', name: 'Orange Habanero', maturity_days: 100 },
      { code: 'CAYENNE', name: 'Cayenne Pepper', maturity_days: 95 },
    ],
  },
  {
    code: 'KARELA',
    name: 'Karela (Bitter Gourd)',
    scientific_name: 'Momordica charantia',
    production_cycle: 'seasonal',
    default_unit: 'kg',
    maturity_days: 60,
    description: 'Bitter gourd (karela) varieties',
    varieties: [
      { code: 'LONG-GREEN', name: 'Long Green Karela', maturity_days: 60 },
      { code: 'SHORT-GREEN', name: 'Short Green Karela', maturity_days: 55 },
      { code: 'DARK-GREEN', name: 'Dark Green Karela', maturity_days: 60 },
      { code: 'WHITE', name: 'White Karela', maturity_days: 60 },
      { code: 'INDIAN', name: 'Indian Karela', maturity_days: 60 },
      { code: 'CHINESE', name: 'Chinese Karela', maturity_days: 55 },
    ],
  },
  {
    code: 'AVOCADO',
    name: 'Avocado',
    scientific_name: 'Persea americana',
    production_cycle: 'perennial',
    default_unit: 'kg',
    maturity_days: 365,
    description: 'Avocado varieties for export and local market',
    varieties: [
      { code: 'HASS', name: 'Hass Avocado', maturity_days: 365 },
      { code: 'FUERTE', name: 'Fuerte Avocado', maturity_days: 365 },
      { code: 'REED', name: 'Reed Avocado', maturity_days: 365 },
      { code: 'BACON', name: 'Bacon Avocado', maturity_days: 365 },
      { code: 'SEMIL-34', name: 'Semil 34 Avocado', maturity_days: 365 },
      { code: 'LOCAL-GREEN', name: 'Local Green Avocado', maturity_days: 300 },
      { code: 'JUMBO', name: 'Jumbo Avocado', maturity_days: 365 },
    ],
  },
  {
    code: 'JACKFRUIT',
    name: 'Jackfruit',
    scientific_name: 'Artocarpus heterophyllus',
    production_cycle: 'perennial',
    default_unit: 'kg',
    maturity_days: 180,
    description: 'Jackfruit varieties',
    varieties: [
      { code: 'SOFT-YELLOW', name: 'Soft Yellow Jackfruit', maturity_days: 180 },
      { code: 'FIRM-YELLOW', name: 'Firm Yellow Jackfruit', maturity_days: 180 },
      { code: 'FIRM-WHITE', name: 'Firm White Jackfruit', maturity_days: 180 },
      { code: 'RED', name: 'Red Jackfruit', maturity_days: 180 },
      { code: 'SWEET', name: 'Sweet Jackfruit', maturity_days: 180 },
      { code: 'SEEDLESS', name: 'Seedless Jackfruit', maturity_days: 180 },
    ],
  },
  {
    code: 'CITRUS',
    name: 'Citrus',
    scientific_name: 'Citrus spp.',
    production_cycle: 'perennial',
    default_unit: 'kg',
    maturity_days: 365,
    description: 'Citrus fruits — oranges, lemons, limes and related',
    varieties: [
      { code: 'VALENCIA', name: 'Valencia Orange', maturity_days: 365 },
      { code: 'NAVEL', name: 'Navel Orange', maturity_days: 365 },
      { code: 'TANGERINE', name: 'Tangerine', maturity_days: 300 },
      { code: 'MANDARIN', name: 'Mandarin', maturity_days: 300 },
      { code: 'CLEMENTINE', name: 'Clementine', maturity_days: 300 },
      { code: 'LEMON', name: 'Lemon', maturity_days: 365 },
      { code: 'LIME', name: 'Lime', maturity_days: 300 },
      { code: 'PERSIAN-LIME', name: 'Persian Lime', maturity_days: 300 },
      { code: 'GRAPEFRUIT', name: 'Grapefruit', maturity_days: 365 },
      { code: 'POMELO', name: 'Pomelo', maturity_days: 365 },
      { code: 'BLOOD-ORANGE', name: 'Blood Orange', maturity_days: 365 },
      { code: 'SWEET-ORANGE', name: 'Sweet Orange', maturity_days: 365 },
    ],
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

  const { data: grades, error: gradesErr } = await sb
    .from('grades')
    .select('id')
    .eq('status', 'active');
  if (gradesErr) throw gradesErr;

  for (const crop of CROPS) {
    const { data: existing } = await sb.from('crops').select('id, name').eq('code', crop.code).maybeSingle();

    let cropId = existing?.id as string | undefined;
    if (cropId) {
      const { error } = await sb
        .from('crops')
        .update({
          name: crop.name,
          scientific_name: crop.scientific_name,
          production_cycle: crop.production_cycle,
          default_unit: crop.default_unit,
          maturity_days: crop.maturity_days,
          description: crop.description,
          status: 'active',
        })
        .eq('id', cropId);
      if (error) throw error;
      console.log(`↻ ${crop.code} → ${crop.name}`);
    } else {
      // Name may collide if someone created the crop under a different code.
      const { data: byName } = await sb.from('crops').select('id, code').eq('name', crop.name).maybeSingle();
      if (byName) {
        cropId = byName.id;
        const { error } = await sb
          .from('crops')
          .update({
            code: crop.code,
            scientific_name: crop.scientific_name,
            production_cycle: crop.production_cycle,
            default_unit: crop.default_unit,
            maturity_days: crop.maturity_days,
            description: crop.description,
            status: 'active',
          })
          .eq('id', cropId);
        if (error) throw error;
        console.log(`↻ renamed code ${byName.code} → ${crop.code}`);
      } else {
        const { data: created, error } = await sb
          .from('crops')
          .insert({
            code: crop.code,
            name: crop.name,
            scientific_name: crop.scientific_name,
            production_cycle: crop.production_cycle,
            default_unit: crop.default_unit,
            maturity_days: crop.maturity_days,
            description: crop.description,
            status: 'active',
          })
          .select('id')
          .single();
        if (error) throw error;
        cropId = created.id;
        console.log(`✓ ${crop.code} → ${crop.name}`);
      }
    }

    if (!cropId) throw new Error(`No crop id for ${crop.code}`);

    if (grades?.length) {
      const { error: gradeLinkErr } = await sb.from('crop_grades').upsert(
        grades.map((g) => ({ crop_id: cropId!, grade_id: g.id })),
        { onConflict: 'crop_id,grade_id', ignoreDuplicates: true }
      );
      if (gradeLinkErr && !/duplicate|unique/i.test(gradeLinkErr.message)) {
        console.warn(`  grades: ${gradeLinkErr.message}`);
      }
    }

    for (let i = 0; i < QC_CRITERIA.length; i++) {
      const name = QC_CRITERIA[i];
      const { data: existingCrit } = await sb
        .from('crop_quality_criteria')
        .select('id')
        .eq('crop_id', cropId)
        .eq('name', name)
        .maybeSingle();
      if (existingCrit) continue;
      const { error: critErr } = await sb.from('crop_quality_criteria').insert({
        crop_id: cropId,
        name,
        criterion_type: 'pass_fail',
        is_mandatory: true,
        sort_order: i + 1,
        status: 'active',
      });
      if (critErr && !/duplicate|unique/i.test(critErr.message)) {
        console.warn(`  QC ${name}: ${critErr.message}`);
      }
    }

    for (const variety of crop.varieties) {
      const { data: existingVar } = await sb
        .from('crop_varieties')
        .select('id')
        .eq('crop_id', cropId)
        .eq('code', variety.code)
        .maybeSingle();

      if (existingVar) {
        const { error } = await sb
          .from('crop_varieties')
          .update({
            name: variety.name,
            maturity_days: variety.maturity_days,
            status: 'active',
          })
          .eq('id', existingVar.id);
        if (error) throw error;
        console.log(`  ↻ ${variety.code} ${variety.name}`);
      } else {
        // Name unique per crop — update if same name exists under another code.
        const { data: byName } = await sb
          .from('crop_varieties')
          .select('id')
          .eq('crop_id', cropId)
          .eq('name', variety.name)
          .maybeSingle();
        if (byName) {
          const { error } = await sb
            .from('crop_varieties')
            .update({
              code: variety.code,
              maturity_days: variety.maturity_days,
              status: 'active',
            })
            .eq('id', byName.id);
          if (error) throw error;
          console.log(`  ↻ name-match ${variety.name}`);
        } else {
          const { error } = await sb.from('crop_varieties').insert({
            crop_id: cropId,
            code: variety.code,
            name: variety.name,
            maturity_days: variety.maturity_days,
            status: 'active',
          });
          if (error) throw error;
          console.log(`  ✓ ${variety.code} ${variety.name}`);
        }
      }
    }
  }

  const { data: summary } = await sb
    .from('crops')
    .select('code, name, crop_varieties(count)')
    .in('code', CROPS.map((c) => c.code))
    .order('code');
  console.log('\nSummary:');
  for (const row of summary ?? []) {
    const count = Array.isArray(row.crop_varieties)
      ? (row.crop_varieties[0] as { count?: number })?.count
      : (row.crop_varieties as { count?: number } | null)?.count;
    console.log(`  ${row.code} (${row.name}): ${count ?? '?'} varieties`);
  }
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

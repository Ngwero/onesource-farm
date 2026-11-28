/**
 * Set farm / contract / system default currency to UGX.
 *   npx tsx scripts/set-currency-ugx.ts
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const farmsUp = await sb
    .from('farms')
    .update({ default_currency: 'UGX' })
    .neq('default_currency', 'UGX')
    .select('id, name, default_currency');
  if (farmsUp.error) throw farmsUp.error;
  console.log(`Farms updated: ${farmsUp.data?.length ?? 0}`);

  const farms = await sb.from('farms').select('id, name, default_currency');
  if (farms.error) throw farms.error;
  console.log('Farms:', farms.data);

  const settings = await sb
    .from('system_settings')
    .upsert(
      {
        key: 'general.default_currency',
        value: 'UGX',
        description: 'Currency used for contracts and reporting',
      },
      { onConflict: 'key' }
    )
    .select('key, value');
  if (settings.error) throw settings.error;
  console.log('Setting:', settings.data);

  const contracts = await sb
    .from('buyer_contracts')
    .update({ currency: 'UGX' })
    .eq('currency', 'USD')
    .select('id');
  if (contracts.error && !/relation|does not exist/i.test(contracts.error.message)) {
    throw contracts.error;
  }
  console.log(`Contracts updated: ${contracts.data?.length ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

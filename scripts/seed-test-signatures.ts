/**
 * Dummy signatures for all active users (workflow smoke tests + UI).
 * Usage: npm run seed:signatures
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { loadEnvLocal, requireSupabaseEnv } from './lib/loadEnv';
import {
  createTestSupabase,
  TEST_SIGNATURE_PATH,
} from './lib/workflowTestUtils';

loadEnvLocal();

async function ensureSignatureImage(uploadRoot: string): Promise<void> {
  const fullPath = path.join(uploadRoot, TEST_SIGNATURE_PATH);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  const width = 420;
  const height = 100;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <path d="M 24 72 Q 120 18, 210 58 T 396 42" stroke="#001D6E" stroke-width="3" fill="none" stroke-linecap="round"/>
      <text x="24" y="92" font-family="Arial, sans-serif" font-size="11" fill="#64748B">Test signature — RukaPay e-Memo</text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(fullPath);
}

async function main() {
  const { url, serviceKey } = requireSupabaseEnv();
  const supabase = createTestSupabase(url, serviceKey);

  const resolvedRoot = path.isAbsolute(process.env.UPLOAD_DIR || '')
    ? process.env.UPLOAD_DIR!
    : path.join(process.cwd(), 'uploads');

  await ensureSignatureImage(resolvedRoot);

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, signature_path')
    .eq('is_active', true)
    .order('email');

  if (error) throw error;
  if (!users?.length) {
    console.error('No active users. Run npm run seed:team first.');
    process.exit(1);
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ signature_path: TEST_SIGNATURE_PATH })
    .eq('is_active', true);

  if (updateError) throw updateError;

  console.log(`✓ Signature image: ${path.join(resolvedRoot, TEST_SIGNATURE_PATH)}`);
  console.log(`✓ Set signature_path for ${users.length} active user(s):\n`);
  for (const u of users) {
    console.log(`  • ${u.email}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

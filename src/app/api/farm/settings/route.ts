import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { SYSTEM_SETTINGS, type SystemSettingKey } from '@/lib/farm/schemas';

export async function GET() {
  return withPermission(undefined, async () => {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('system_settings').select('key, value, description, updated_at');
    if (error) throw error;
    const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    return NextResponse.json({ settings });
  });
}

export async function PUT(request: Request) {
  return withPermission('admin.settings', async ({ user }) => {
    const body = await parseBody(request, z.record(z.string(), z.unknown()));
    const fieldErrors: Record<string, string> = {};
    const rows: { key: SystemSettingKey; value: unknown; updated_by: string }[] = [];

    for (const [key, raw] of Object.entries(body)) {
      const def = SYSTEM_SETTINGS[key as SystemSettingKey];
      if (!def) {
        fieldErrors[key] = 'Unknown setting';
        continue;
      }
      const parsed = def.schema.safeParse(raw);
      if (!parsed.success) {
        fieldErrors[key] = parsed.error.issues[0]?.message ?? 'Invalid value';
        continue;
      }
      rows.push({ key: key as SystemSettingKey, value: parsed.data, updated_by: user.id });
    }
    if (Object.keys(fieldErrors).length) {
      throw new HttpError('Please correct the highlighted fields.', 400, fieldErrors);
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'system_settings', user.id, {
      new: Object.fromEntries(rows.map((r) => [r.key, r.value])),
    });
    return NextResponse.json({ ok: true });
  });
}

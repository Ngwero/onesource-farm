import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { BLOCK_STATUSES, SIZE_UNITS } from '@/lib/farm/schemas';

const rowSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(16).regex(/^[A-Z0-9-]+$/),
  name: z.string().trim().min(1).max(120),
  size_value: z.number().positive(),
  size_unit: z.enum(SIZE_UNITS),
  status: z.enum(BLOCK_STATUSES),
  soil_type: z.string().trim().max(80).nullable().optional(),
  irrigation_type: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('farm.manage', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const created: string[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const { data, error } = await supabase
        .from('blocks')
        .insert({
          code: row.code,
          name: row.name,
          size_value: row.size_value,
          size_unit: row.size_unit,
          status: row.status,
          soil_type: row.soil_type ?? null,
          irrigation_type: row.irrigation_type ?? null,
          notes: row.notes ?? null,
          farm_id: farmId,
          created_by: user.id,
        })
        .select('id, code')
        .single();
      if (error) {
        errors.push({
          row: i + 1,
          error: error.code === '23505' ? `Duplicate block code ${row.code}` : error.message,
        });
        continue;
      }
      created.push(data.code as string);
      await auditFarm(user.id, 'created', 'block', data.id, { new: { ...row, import: true } });
    }

    if (created.length === 0 && errors.length > 0) {
      throw new HttpError('No blocks were imported.', 400, {
        _: errors.map((e) => `Row ${e.row}: ${e.error}`).join('; '),
      });
    }

    return NextResponse.json({
      created: created.length,
      codes: created,
      errors,
    });
  });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { CROP_UNITS, PRODUCTION_CYCLES } from '@/lib/farm/schemas';

const rowSchema = z.object({
  code: z.string().trim().toUpperCase().min(2).max(12).regex(/^[A-Z0-9]{2,12}$/),
  name: z.string().trim().min(1).max(120),
  scientific_name: z.string().trim().max(120).nullable().optional(),
  production_cycle: z.enum(PRODUCTION_CYCLES),
  default_unit: z.enum(CROP_UNITS),
  maturity_days: z.number().int().positive().nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('crops.manage', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();

    const { data: grades, error: gradesError } = await supabase
      .from('grades')
      .select('id')
      .eq('status', 'active');
    if (gradesError) throw gradesError;

    const created: string[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const { data, error } = await supabase
        .from('crops')
        .insert({
          code: row.code,
          name: row.name,
          scientific_name: row.scientific_name ?? null,
          production_cycle: row.production_cycle,
          default_unit: row.default_unit,
          maturity_days: row.maturity_days ?? null,
          description: row.description ?? null,
          status: row.status,
          created_by: user.id,
        })
        .select('id, code')
        .single();
      if (error) {
        errors.push({
          row: i + 1,
          error: error.code === '23505' ? `Duplicate crop code ${row.code}` : error.message,
        });
        continue;
      }

      if (grades?.length) {
        const { error: linkError } = await supabase
          .from('crop_grades')
          .insert(grades.map((g) => ({ crop_id: data.id, grade_id: g.id })));
        if (linkError) {
          errors.push({ row: i + 1, error: `Crop saved but grades failed: ${linkError.message}` });
        }
      }

      created.push(data.code as string);
      await auditFarm(user.id, 'created', 'crop', data.id, { new: { ...row, import: true } });
    }

    if (created.length === 0 && errors.length > 0) {
      throw new HttpError('No crops were imported.', 400, {
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

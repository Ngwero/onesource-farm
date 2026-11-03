import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { WORKER_CATEGORIES, WORKER_STATUSES, PAY_BASES } from '@/lib/farm/schemas';

const rowSchema = z
  .object({
    worker_code: z.string().trim().toUpperCase().min(1).max(20).regex(/^[A-Z0-9-]+$/),
    full_name: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(30).nullable().optional(),
    national_id: z.string().trim().max(40).nullable().optional(),
    category: z.enum(WORKER_CATEGORIES),
    job_role: z.string().trim().max(80).nullable().optional(),
    status: z.enum(WORKER_STATUSES).default('active'),
    start_date: z.string().nullable().optional(),
    pay_basis: z.enum(PAY_BASES),
    daily_rate: z.number().min(0).nullable().optional(),
    monthly_salary: z.number().min(0).nullable().optional(),
    overtime_rate: z.number().min(0).default(0),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((v) => v.pay_basis !== 'daily' || v.daily_rate != null, {
    path: ['daily_rate'],
    message: 'daily_rate required for daily pay',
  })
  .refine((v) => v.pay_basis !== 'monthly' || v.monthly_salary != null, {
    path: ['monthly_salary'],
    message: 'monthly_salary required for monthly pay',
  });

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('workforce.manage', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const created: string[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const { data, error } = await supabase
        .from('workers')
        .insert({
          worker_code: row.worker_code,
          full_name: row.full_name,
          phone: row.phone ?? null,
          national_id: row.national_id ?? null,
          category: row.category,
          job_role: row.job_role ?? null,
          status: row.status,
          start_date: row.start_date || null,
          pay_basis: row.pay_basis,
          daily_rate: row.pay_basis === 'daily' ? row.daily_rate : null,
          monthly_salary: row.pay_basis === 'monthly' ? row.monthly_salary : null,
          overtime_rate: row.overtime_rate ?? 0,
          notes: row.notes ?? null,
          farm_id: farmId,
          created_by: user.id,
        })
        .select('id, worker_code')
        .single();
      if (error) {
        errors.push({
          row: i + 1,
          error: error.code === '23505' ? `Duplicate worker code ${row.worker_code}` : error.message,
        });
        continue;
      }
      created.push(data.worker_code as string);
      await auditFarm(user.id, 'created', 'worker', data.id, { new: { ...row, import: true } });
    }

    if (created.length === 0 && errors.length > 0) {
      throw new HttpError('No workers were imported.', 400, {
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

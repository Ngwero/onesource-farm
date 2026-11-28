import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { importJson, type ImportRowError } from '@/lib/farm/importResult';
import { ATTENDANCE_STATUSES } from '@/lib/farm/schemas';

const rowSchema = z.object({
  attendance_date: z.string().trim().min(1),
  worker_code: z.string().trim().toUpperCase().min(1).max(20),
  status: z.enum(ATTENDANCE_STATUSES),
  hours_worked: z.number().min(0).nullable().optional(),
  overtime_hours: z.number().min(0).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('attendance.record', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const workerCodes = [...new Set(input.rows.map((r) => r.worker_code))];
    const { data: workers, error: workersError } = await supabase
      .from('workers')
      .select('id, worker_code')
      .eq('farm_id', farmId)
      .in('worker_code', workerCodes);
    if (workersError) throw workersError;
    const workerByCode = new Map((workers ?? []).map((w) => [w.worker_code as string, w.id as string]));

    const created: string[] = [];
    const errors: ImportRowError[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const workerId = workerByCode.get(row.worker_code);
      if (!workerId) {
        errors.push({ row: i + 1, error: `Unknown worker code ${row.worker_code}` });
        continue;
      }
      const payload = {
        farm_id: farmId,
        worker_id: workerId,
        attendance_date: row.attendance_date,
        status: row.status,
        hours_worked: row.status === 'present' ? (row.hours_worked ?? null) : null,
        overtime_hours: row.status === 'present' ? (row.overtime_hours ?? 0) : 0,
        notes: row.notes ?? null,
        recorded_by: user.id,
      };
      const { error } = await supabase
        .from('worker_attendance')
        .upsert(payload, { onConflict: 'worker_id,attendance_date' });
      if (error) {
        errors.push({ row: i + 1, error: error.message });
        continue;
      }
      created.push(`${row.attendance_date}/${row.worker_code}`);
      await auditFarm(user.id, 'updated', 'attendance', farmId, {
        new: { ...row, import: true },
      });
    }

    return importJson(created, errors, 'No attendance rows were imported.');
  });
}

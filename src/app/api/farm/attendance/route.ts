import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { getLabourSettings } from '@/lib/farm/operations';
import { attendanceSaveSchema } from '@/lib/farm/schemas';

const isoDate = z.iso.date();

function todayPlusOne(): string {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

/**
 * ?date=YYYY-MM-DD → the day's register (workers + their entries).
 * ?from=…&to=… → per-worker totals for the range.
 */
export async function GET(request: Request) {
  return withPermission(undefined, async ({ can }) => {
    if (!can('workforce.view') && !can('attendance.record')) {
      throw new HttpError('You do not have permission to view attendance.', 403);
    }
    const url = new URL(request.url);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from && to) {
      if (!isoDate.safeParse(from).success || !isoDate.safeParse(to).success || to < from) {
        throw new HttpError('Choose a valid date range', 400);
      }
      const { data, error } = await supabase
        .from('worker_attendance')
        .select('worker_id, status, hours_worked, overtime_hours')
        .eq('farm_id', farmId)
        .gte('attendance_date', from)
        .lte('attendance_date', to);
      if (error) throw error;
      const totals = new Map<string, { present: number; absent: number; leave: number; off: number; hours: number; overtime: number }>();
      for (const r of data ?? []) {
        const t = totals.get(r.worker_id) ?? { present: 0, absent: 0, leave: 0, off: 0, hours: 0, overtime: 0 };
        t[r.status as 'present' | 'absent' | 'leave' | 'off'] += 1;
        t.hours += Number(r.hours_worked ?? 0);
        t.overtime += Number(r.overtime_hours ?? 0);
        totals.set(r.worker_id, t);
      }
      return NextResponse.json({ summary: Object.fromEntries(totals) });
    }

    const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    if (!isoDate.safeParse(date).success) throw new HttpError('Choose a valid date', 400);
    const [workersRes, entriesRes, labour] = await Promise.all([
      supabase
        .from('workers')
        .select('id, worker_code, full_name, category, job_role, status, start_date, end_date')
        .eq('farm_id', farmId)
        .order('worker_code'),
      supabase
        .from('worker_attendance')
        .select('worker_id, status, hours_worked, overtime_hours, notes, recorded_by_user:users!worker_attendance_recorded_by_fkey(full_name)')
        .eq('farm_id', farmId)
        .eq('attendance_date', date),
      getLabourSettings(supabase),
    ]);
    if (workersRes.error) throw workersRes.error;
    if (entriesRes.error) throw entriesRes.error;

    const entries = entriesRes.data ?? [];
    const marked = new Set(entries.map((e) => e.worker_id));
    // Show active workers employed on the date, plus anyone already marked that day.
    const workers = (workersRes.data ?? []).filter(
      (w) =>
        marked.has(w.id) ||
        (w.status === 'active' && (!w.start_date || w.start_date <= date) && (!w.end_date || w.end_date >= date))
    );
    return NextResponse.json({ date, workers, entries, standardDayHours: labour.dayHours });
  });
}

export async function PUT(request: Request) {
  return withPermission('attendance.record', async ({ user }) => {
    const input = await parseBody(request, attendanceSaveSchema);
    if (input.attendance_date > todayPlusOne()) {
      throw new HttpError('Attendance cannot be recorded for future dates.', 400, { attendance_date: 'Future date' });
    }
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const rows = input.entries.map((e) => ({
      farm_id: farmId,
      worker_id: e.worker_id,
      attendance_date: input.attendance_date,
      status: e.status,
      hours_worked: e.status === 'present' ? (e.hours_worked ?? null) : null,
      overtime_hours: e.status === 'present' ? e.overtime_hours : 0,
      notes: e.notes ?? null,
      recorded_by: user.id,
    }));
    const { error } = await supabase.from('worker_attendance').upsert(rows, { onConflict: 'worker_id,attendance_date' });
    if (error) throw error;
    await auditFarm(user.id, 'updated', 'attendance', farmId, {
      new: { date: input.attendance_date, entries: rows.length },
    });
    return NextResponse.json({ saved: rows.length });
  });
}

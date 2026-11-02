import type { SupabaseClient } from '@supabase/supabase-js';
import { eachDayOfInterval, format, subDays } from 'date-fns';
import { gradingStats } from './grading';
import { normalizeBatches } from './operations';
import { HARVEST_SELECT } from './queries';
import type { Permission } from './permissions';
import type { FarmOperations } from './types';

const DAYS = 30;

type RawBatchArg = Parameters<typeof normalizeBatches>[1];

/**
 * Day-to-day figures for the farm dashboard. Each section is only loaded when the user
 * may see the underlying records, so the dashboard never leaks data the pages would hide.
 */
export async function loadFarmOperations(
  supabase: SupabaseClient,
  farmId: string,
  can: (p: Permission) => boolean
): Promise<FarmOperations> {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const since = format(subDays(now, DAYS - 1), 'yyyy-MM-dd');
  const ops: FarmOperations = { since, recent: [] };

  const tasks: Promise<void>[] = [];

  if (can('harvest.view')) {
    tasks.push(
      (async () => {
        const [recentRes, pendingRes] = await Promise.all([
          supabase.from('harvest_batches').select(HARVEST_SELECT).eq('farm_id', farmId).gte('harvest_date', since),
          supabase
            .from('harvest_batches')
            .select('id', { count: 'exact', head: true })
            .eq('farm_id', farmId)
            .eq('status', 'pending_grading'),
        ]);
        if (recentRes.error) throw recentRes.error;
        if (pendingRes.error) throw pendingRes.error;
        const batches = await normalizeBatches(supabase, (recentRes.data ?? []) as unknown as RawBatchArg);

        const byUnit = new Map<string, number>();
        for (const b of batches) byUnit.set(b.unit, (byUnit.get(b.unit) ?? 0) + Number(b.quantity));
        const unit = [...byUnit.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'kg';

        const perDay = new Map<string, number>();
        let gradedQty = 0;
        let exportable = 0;
        let rejected = 0;
        for (const b of batches) {
          if (b.unit === unit) perDay.set(b.harvest_date, (perDay.get(b.harvest_date) ?? 0) + Number(b.quantity));
          if (b.grading) {
            const s = gradingStats(b.grading.lines, Number(b.quantity));
            gradedQty += Number(b.quantity);
            exportable += s.exportable;
            rejected += s.rejected;
          }
        }

        ops.harvest = {
          unit,
          total: byUnit.get(unit) ?? 0,
          otherUnits: [...byUnit.entries()].filter(([u]) => u !== unit).map(([u, q]) => ({ unit: u, quantity: q })),
          batches: batches.length,
          pendingGrading: pendingRes.count ?? 0,
          exportablePct: gradedQty > 0 ? (exportable / gradedQty) * 100 : null,
          rejectionPct: gradedQty > 0 ? (rejected / gradedQty) * 100 : null,
          series: eachDayOfInterval({ start: subDays(now, DAYS - 1), end: now }).map((d) => {
            const date = format(d, 'yyyy-MM-dd');
            return { date, quantity: perDay.get(date) ?? 0 };
          }),
          labourCost: batches.reduce((s, b) => s + Number(b.worker_labour_cost) + Number(b.other_labour_cost), 0),
        };
        for (const b of [...batches].sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 5)) {
          ops.recent.push({
            kind: 'harvest',
            id: b.id,
            title: `${b.batch_no}`,
            detail: `${Number(b.quantity).toLocaleString('en-GB')} ${b.unit} ${b.crop?.name ?? ''} from ${b.block?.code ?? ''}`,
            date: b.harvest_date,
            at: b.created_at,
            href: `/harvest/batches/${b.id}`,
          });
        }
      })()
    );
  }

  if (can('activities.view')) {
    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from('farm_activities')
          .select(
            'id, activity_date, created_at, total_cost, worker_labour_cost, other_labour_cost, input_cost, block:blocks!farm_activities_block_id_farm_id_fkey(code), activity_type:activity_types!farm_activities_activity_type_id_fkey(name)'
          )
          .eq('farm_id', farmId)
          .gte('activity_date', since);
        if (error) throw error;
        type Row = {
          id: string;
          activity_date: string;
          created_at: string;
          total_cost: number;
          worker_labour_cost: number;
          other_labour_cost: number;
          input_cost: number;
          block: { code: string } | null;
          activity_type: { name: string } | null;
        };
        const rows = (data ?? []) as unknown as Row[];
        ops.activities = {
          count: rows.length,
          totalCost: rows.reduce((s, r) => s + Number(r.total_cost), 0),
          labourCost: rows.reduce((s, r) => s + Number(r.worker_labour_cost) + Number(r.other_labour_cost), 0),
          inputCost: rows.reduce((s, r) => s + Number(r.input_cost), 0),
        };
        for (const r of [...rows].sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 5)) {
          ops.recent.push({
            kind: 'activity',
            id: r.id,
            title: r.activity_type?.name ?? 'Activity',
            detail: `Block ${r.block?.code ?? ''}`,
            date: r.activity_date,
            at: r.created_at,
            href: `/farm/activities/${r.id}`,
          });
        }
      })()
    );
  }

  if (can('pest.view')) {
    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from('pest_disease_incidents')
          .select('id, name, severity, status, follow_up_date, date_identified, created_at, block:blocks!pest_disease_incidents_block_id_farm_id_fkey(code)')
          .eq('farm_id', farmId)
          .neq('status', 'resolved')
          .order('date_identified', { ascending: false });
        if (error) throw error;
        type Row = {
          id: string;
          name: string;
          severity: string;
          status: string;
          follow_up_date: string | null;
          date_identified: string;
          created_at: string;
          block: { code: string } | null;
        };
        const rows = (data ?? []) as unknown as Row[];
        ops.incidents = {
          unresolved: rows.length,
          severe: rows.filter((r) => r.severity === 'high' || r.severity === 'critical').length,
          followUpDue: rows.filter((r) => r.follow_up_date && r.follow_up_date <= today).length,
        };
        for (const r of rows.filter((x) => x.date_identified >= since).slice(0, 5)) {
          ops.recent.push({
            kind: 'incident',
            id: r.id,
            title: r.name,
            detail: `${r.severity} severity · Block ${r.block?.code ?? ''}`,
            date: r.date_identified,
            at: r.created_at,
            href: `/farm/incidents/${r.id}`,
          });
        }
      })()
    );
  }

  if (can('workforce.view') || can('attendance.record')) {
    tasks.push(
      (async () => {
        const [workersRes, attendanceRes] = await Promise.all([
          supabase.from('workers').select('id', { count: 'exact', head: true }).eq('farm_id', farmId).eq('status', 'active'),
          supabase.from('worker_attendance').select('status').eq('farm_id', farmId).eq('attendance_date', today),
        ]);
        if (workersRes.error) throw workersRes.error;
        if (attendanceRes.error) throw attendanceRes.error;
        const marks = attendanceRes.data ?? [];
        ops.workforce = {
          activeWorkers: workersRes.count ?? 0,
          markedToday: marks.length,
          presentToday: marks.filter((m) => m.status === 'present').length,
        };
      })()
    );
  }

  if (can('workforce.view')) {
    tasks.push(
      (async () => {
        const { data, error } = await supabase
          .from('worker_tasks')
          .select('due_at')
          .eq('farm_id', farmId)
          .in('status', ['assigned', 'in_progress']);
        if (error) throw error;
        const nowIso = now.toISOString();
        ops.tasks = {
          open: data?.length ?? 0,
          overdue: (data ?? []).filter((t) => t.due_at && t.due_at < nowIso).length,
        };
      })()
    );
  }

  if (can('qc.view') || can('warehouse.view')) {
    tasks.push(
      (async () => {
        const count = (q: PromiseLike<{ count: number | null; error: unknown }>) =>
          q.then((r) => {
            if (r.error) throw r.error;
            return r.count ?? 0;
          });
        const packing = () => supabase.from('packing_batches').select('id', { count: 'exact', head: true }).eq('farm_id', farmId);
        const [awaitingReview, awaitingRelease, awaitingReceipt] = await Promise.all([
          can('qc.view')
            ? count(
                supabase
                  .from('qc_inspections')
                  .select('id', { count: 'exact', head: true })
                  .eq('farm_id', farmId)
                  .eq('review_status', 'awaiting_review')
              )
            : null,
          can('qc.view') ? count(packing().eq('qc_status', 'approved')) : null,
          can('warehouse.view') ? count(packing().is('received_date', null)) : null,
        ]);
        ops.packhouse = { awaitingReview, awaitingRelease, awaitingReceipt };
      })()
    );
  }

  await Promise.all(tasks);
  ops.recent = ops.recent.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  return ops;
}

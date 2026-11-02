'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { CheckCheck, ChevronLeft, ChevronRight, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, todayIso } from '@/lib/farm/format';
import { ATTENDANCE_STATUSES, optionLabel } from '@/lib/farm/schemas';
import type { AttendanceEntry } from '@/lib/farm/types';

type RegisterWorker = { id: string; worker_code: string; full_name: string; category: string; job_role: string | null };
type Register = {
  date: string;
  workers: RegisterWorker[];
  entries: (AttendanceEntry & { recorded_by_user: { full_name: string } | null })[];
  standardDayHours: number;
};
type Draft = {
  status: AttendanceEntry['status'] | null;
  hours_worked: string;
  overtime_hours: string;
  notes: string;
};

const UNMARKED = 'unmarked';
const COLUMNS = 5;

function toDrafts(register: Register): Record<string, Draft> {
  const byWorker = new Map(register.entries.map((e) => [e.worker_id, e]));
  return Object.fromEntries(
    register.workers.map((w) => {
      const e = byWorker.get(w.id);
      return [
        w.id,
        {
          status: e?.status ?? null,
          hours_worked: e?.hours_worked == null ? '' : String(Number(e.hours_worked)),
          overtime_hours: e && Number(e.overtime_hours) ? String(Number(e.overtime_hours)) : '',
          notes: e?.notes ?? '',
        },
      ];
    })
  );
}

function RegisterTable({ register, canRecord }: { register: Register; canRecord: boolean }) {
  const queryClient = useQueryClient();
  const initial = useMemo(() => toDrafts(register), [register]);
  const [drafts, setDrafts] = useState(initial);
  const dirty = JSON.stringify(drafts) !== JSON.stringify(initial);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, leave: 0, off: 0, unmarked: 0 };
    for (const d of Object.values(drafts)) c[d.status ?? 'unmarked'] += 1;
    return c;
  }, [drafts]);

  function update(workerId: string, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const next = { ...prev[workerId], ...patch };
      if (next.status !== 'present') {
        next.hours_worked = '';
        next.overtime_hours = '';
      }
      return { ...prev, [workerId]: next };
    });
  }

  function markAllPresent() {
    setDrafts((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, d]) => [
          id,
          d.status ? d : { ...d, status: 'present' as const, hours_worked: String(register.standardDayHours) },
        ])
      )
    );
  }

  const save = useMutation({
    mutationFn: () => {
      const entries = Object.entries(drafts)
        .filter(([, d]) => d.status)
        .map(([worker_id, d]) => ({
          worker_id,
          status: d.status!,
          hours_worked: d.hours_worked === '' ? null : Number(d.hours_worked),
          overtime_hours: d.overtime_hours === '' ? 0 : Number(d.overtime_hours),
          notes: d.notes.trim() || null,
        }));
      return farmFetch<{ saved: number }>('/api/farm/attendance', {
        method: 'PUT',
        body: { attendance_date: register.date, entries },
      });
    },
    onSuccess: async (r) => {
      toast.success(`Attendance saved for ${r.saved} worker${r.saved === 1 ? '' : 's'}`);
      await queryClient.invalidateQueries({ queryKey: farmKeys.attendance });
      await queryClient.invalidateQueries({ queryKey: farmKeys.workers });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const marked = register.workers.length - counts.unmarked;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span>
          <strong>{counts.present}</strong> present
        </span>
        <span>
          <strong>{counts.absent}</strong> absent
        </span>
        <span>
          <strong>{counts.leave}</strong> on leave
        </span>
        <span>
          <strong>{counts.off}</strong> off
        </span>
        {counts.unmarked ? <span className="text-amber-700">{counts.unmarked} not marked</span> : null}
        {canRecord ? (
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={markAllPresent} disabled={!counts.unmarked || save.isPending}>
              <CheckCheck className="size-4" /> Mark unmarked present
            </Button>
            <Button onClick={() => save.mutate()} disabled={!dirty || !marked || save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save register
            </Button>
          </div>
        ) : null}
      </div>
      {dirty ? <p className="text-xs text-amber-700">You have unsaved changes for {fmtDate(register.date)}.</p> : null}

      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead className="w-28">Hours</TableHead>
              <TableHead className="w-28">Overtime (h)</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {register.workers.length === 0 ? (
              <EmptyRow
                columns={COLUMNS}
                title="No active workers on this date"
                description="Workers appear here when they are active and their start date is on or before this day."
                action={
                  <Button asChild variant="outline">
                    <Link href="/workforce/workers">Go to workers</Link>
                  </Button>
                }
              />
            ) : (
              register.workers.map((w) => {
                const d = drafts[w.id];
                const present = d.status === 'present';
                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      <span className="font-medium">{w.full_name}</span>
                      <p className="text-xs text-muted-foreground">
                        {w.worker_code} · {optionLabel(w.category)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={d.status ?? UNMARKED}
                        onValueChange={(v) => update(w.id, { status: v === UNMARKED ? null : (v as Draft['status']) })}
                        disabled={!canRecord}
                      >
                        <SelectTrigger className="w-full" aria-label={`Status for ${w.full_name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNMARKED}>Not marked</SelectItem>
                          {ATTENDANCE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {optionLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={24}
                        step="0.5"
                        value={d.hours_worked}
                        onChange={(e) => update(w.id, { hours_worked: e.target.value })}
                        disabled={!canRecord || !present}
                        aria-label={`Hours for ${w.full_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={24}
                        step="0.5"
                        value={d.overtime_hours}
                        onChange={(e) => update(w.id, { overtime_hours: e.target.value })}
                        disabled={!canRecord || !present}
                        aria-label={`Overtime for ${w.full_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={d.notes}
                        maxLength={300}
                        onChange={(e) => update(w.id, { notes: e.target.value })}
                        disabled={!canRecord || !d.status}
                        aria-label={`Notes for ${w.full_name}`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useFarmAccess();
  const today = todayIso();
  const date = searchParams.get('date') ?? today;

  const register = useQuery({
    queryKey: [...farmKeys.attendance, date],
    queryFn: () => farmFetch<Register>(`/api/farm/attendance?date=${date}`),
    refetchOnWindowFocus: false,
  });

  function go(next: string) {
    if (next && next <= today) router.replace(`/workforce/attendance?date=${next}`);
  }
  const shift = (days: number) => format(addDays(parseISO(date), days), 'yyyy-MM-dd');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        subtitle="Daily register. Days present and overtime feed payroll costing."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => go(shift(-1))} aria-label="Previous day">
          <ChevronLeft className="size-4" />
        </Button>
        <Input type="date" className="w-44" value={date} max={today} onChange={(e) => go(e.target.value)} />
        <Button variant="outline" size="icon" onClick={() => go(shift(1))} disabled={date >= today} aria-label="Next day">
          <ChevronRight className="size-4" />
        </Button>
        {date !== today ? (
          <Button variant="ghost" onClick={() => go(today)}>
            Today
          </Button>
        ) : null}
        <p className="text-sm font-medium sm:ml-2">{format(parseISO(date), 'EEEE d MMMM yyyy')}</p>
      </div>

      {register.error ? (
        <ErrorState message={errorMessage(register.error)} onRetry={() => register.refetch()} />
      ) : !register.data ? (
        <div className="data-table">
          <Table>
            <TableBody>
              <LoadingRows columns={COLUMNS} />
            </TableBody>
          </Table>
        </div>
      ) : (
        <RegisterTable
          key={register.data.date}
          register={register.data}
          canRecord={can('attendance.record')}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission={['workforce.view', 'attendance.record']}>
      <Suspense>
        <AttendancePage />
      </Suspense>
    </RequirePermission>
  );
}

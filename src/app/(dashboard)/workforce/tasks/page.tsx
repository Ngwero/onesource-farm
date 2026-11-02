'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { TaskSheet } from '@/components/farm/forms/TaskSheet';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDateTime, fmtNumber, fmtPct, fmtQty } from '@/lib/farm/format';
import type { TaskRow } from '@/lib/farm/types';

const SCOPES = [
  { value: 'open', label: 'Open tasks' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All tasks' },
];
const COLUMNS = 8;

function productivity(t: TaskRow): number | null {
  const target = Number(t.target_quantity ?? 0);
  return target > 0 && t.achieved_quantity != null ? (Number(t.achieved_quantity) / target) * 100 : null;
}

function isOverdue(t: TaskRow): boolean {
  return Boolean(t.due_at) && (t.status === 'assigned' || t.status === 'in_progress') && new Date(t.due_at!) < new Date();
}

function TasksPage() {
  const { can } = useFarmAccess();
  const canManage = can('workforce.manage');
  const canUpdate = canManage || can('activities.record');
  const [scope, setScope] = useState('open');
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState<{ open: boolean; task: TaskRow | null }>({ open: false, task: null });
  const [deleting, setDeleting] = useState<TaskRow | null>(null);

  const tasks = useQuery({
    queryKey: [...farmKeys.tasks, scope],
    queryFn: () =>
      farmFetch<{ tasks: TaskRow[] }>(`/api/farm/tasks${scope === 'all' ? '' : `?status=${scope}`}`).then((r) => r.tasks),
  });

  const remove = useActionMutation((id: string) => farmFetch(`/api/farm/tasks/${id}`, { method: 'DELETE' }), {
    success: 'Task deleted',
    invalidate: [farmKeys.tasks],
    onDone: () => setDeleting(null),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasks.data ?? []).filter(
      (t) =>
        !q ||
        `${t.worker?.full_name} ${t.worker?.worker_code} ${t.activity_type?.name} ${t.block?.code ?? ''}`.toLowerCase().includes(q)
    );
  }, [tasks.data, search]);

  const stats = useMemo(() => {
    const list = filtered;
    const withProductivity = list.map(productivity).filter((p): p is number => p != null);
    return {
      overdue: list.filter(isOverdue).length,
      inProgress: list.filter((t) => t.status === 'in_progress').length,
      hours: list.reduce((s, t) => s + Number(t.hours_spent ?? 0), 0),
      avgProductivity: withProductivity.length
        ? withProductivity.reduce((s, p) => s + p, 0) / withProductivity.length
        : null,
    };
  }, [filtered]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        subtitle="Work assigned to individual workers, with targets to measure productivity."
        actions={
          canManage ? (
            <Button onClick={() => setSheet({ open: true, task: null })}>
              <Plus className="size-4" /> Assign task
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Tasks shown" value={filtered.length} />
        <KpiCard label="In progress" value={stats.inProgress} />
        <KpiCard label="Overdue" value={stats.overdue} hint={stats.overdue ? 'Past due and not completed' : undefined} />
        <KpiCard
          label="Avg. productivity"
          value={fmtPct(stats.avgProductivity, 0)}
          hint={`Achieved vs target · ${fmtNumber(stats.hours)} h logged`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search worker, activity or block"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCOPES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tasks.error ? (
        <ErrorState message={errorMessage(tasks.error)} onRetry={() => tasks.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Block / crop</TableHead>
                <TableHead>Start / due</TableHead>
                <TableHead className="text-right">Achieved / target</TableHead>
                <TableHead className="text-right">Productivity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title={tasks.data?.length ? 'No tasks match your search' : 'No tasks here'}
                  description={tasks.data?.length ? undefined : 'Assign work to workers to track progress and productivity.'}
                  action={
                    !tasks.data?.length && canManage ? (
                      <Button onClick={() => setSheet({ open: true, task: null })}>
                        <Plus className="size-4" /> Assign task
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((t) => {
                  const p = productivity(t);
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <span className="font-medium">{t.worker?.full_name}</span>
                        <p className="text-xs text-muted-foreground">{t.worker?.worker_code}</p>
                      </TableCell>
                      <TableCell>
                        {t.activity_type?.name}
                        {t.notes ? <p className="line-clamp-1 max-w-56 text-xs text-muted-foreground">{t.notes}</p> : null}
                      </TableCell>
                      <TableCell>
                        {t.block?.code ?? '—'}
                        {t.crop ? <p className="text-xs text-muted-foreground">{t.crop.name}</p> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {fmtDateTime(t.start_at)}
                        {t.due_at ? (
                          <p className={isOverdue(t) ? 'text-xs font-medium text-red-700' : 'text-xs text-muted-foreground'}>
                            Due {fmtDateTime(t.due_at)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {t.target_quantity != null
                          ? `${fmtNumber(t.achieved_quantity ?? 0)} / ${fmtQty(t.target_quantity, t.quantity_unit)}`
                          : t.achieved_quantity != null
                            ? fmtQty(t.achieved_quantity, t.quantity_unit)
                            : '—'}
                      </TableCell>
                      <TableCell className="text-right">{fmtPct(p, 0)}</TableCell>
                      <TableCell>
                        <StatusChip status={isOverdue(t) ? 'overdue' : t.status} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {canUpdate ? (
                          <Button variant="ghost" size="sm" onClick={() => setSheet({ open: true, task: t })} aria-label="Edit task">
                            <Pencil className="size-4" />
                          </Button>
                        ) : null}
                        {canManage ? (
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(t)} aria-label="Delete task">
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskSheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} task={sheet.task} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this task?"
        description={
          deleting ? `${deleting.activity_type?.name} for ${deleting.worker?.full_name} will be removed. Cancel it instead to keep a record.` : ''
        }
        confirmLabel="Delete task"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="workforce.view">
      <TasksPage />
    </RequirePermission>
  );
}

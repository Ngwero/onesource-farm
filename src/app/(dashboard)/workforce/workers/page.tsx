'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { WorkerFormSheet } from '@/components/farm/forms/WorkerFormSheet';
import { useCurrency, useWorkers } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage } from '@/lib/farm/client';
import { fmtMoney } from '@/lib/farm/format';
import { WORKER_CATEGORIES, WORKER_STATUSES, optionLabel } from '@/lib/farm/schemas';

const ALL = 'all';
const COLUMNS = 7;

function WorkersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useFarmAccess();
  const currency = useCurrency();
  const workers = useWorkers();
  const [creating, setCreating] = useState(searchParams.get('new') === '1');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState(ALL);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (workers.data ?? []).filter((w) => {
      if (status !== ALL && w.status !== status) return false;
      if (category !== ALL && w.category !== category) return false;
      if (q && !`${w.worker_code} ${w.full_name} ${w.job_role ?? ''} ${w.phone ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [workers.data, search, status, category]);

  const counts = useMemo(() => {
    const active = (workers.data ?? []).filter((w) => w.status === 'active');
    return {
      permanent: active.filter((w) => w.category === 'permanent').length,
      casual: active.filter((w) => w.category === 'casual').length,
    };
  }, [workers.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workers"
        subtitle={`${counts.permanent} permanent and ${counts.casual} casual workers active.`}
        actions={
          can('workforce.manage') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New worker
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search ID, name, role or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {WORKER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {optionLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {WORKER_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {optionLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} worker{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      {workers.error ? (
        <ErrorState message={errorMessage(workers.error)} onRetry={() => workers.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Pay</TableHead>
                <TableHead className="text-right">Cost per hour</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title={workers.data?.length ? 'No workers match these filters' : 'No workers yet'}
                  description={workers.data?.length ? undefined : 'Add permanent staff and casual labourers to record attendance and cost labour.'}
                  action={
                    !workers.data?.length && can('workforce.manage') ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> New worker
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((w) => (
                  <TableRow key={w.id} className="cursor-pointer" onClick={() => router.push(`/workforce/workers/${w.id}`)}>
                    <TableCell>
                      <Link
                        href={`/workforce/workers/${w.id}`}
                        className="font-semibold text-brand-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {w.full_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {w.worker_code}
                        {w.job_role ? ` · ${w.job_role}` : ''}
                      </p>
                    </TableCell>
                    <TableCell>{optionLabel(w.category)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {w.pay_basis === 'daily'
                        ? `${fmtMoney(w.daily_rate, currency)} / day`
                        : `${fmtMoney(w.monthly_salary, currency)} / month`}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtMoney(w.hourly_rate, currency)}</TableCell>
                    <TableCell>{w.supervisor?.full_name ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{w.phone || '—'}</TableCell>
                    <TableCell>
                      <StatusChip status={w.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <WorkerFormSheet
        open={creating}
        onOpenChange={setCreating}
        onSaved={(w) => router.push(`/workforce/workers/${w.id}`)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="workforce.view">
      <Suspense>
        <WorkersPage />
      </Suspense>
    </RequirePermission>
  );
}

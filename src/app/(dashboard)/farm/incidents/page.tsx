'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { IncidentFormSheet } from '@/components/farm/forms/IncidentFormSheet';
import { farmKeys, useBlocks } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtHa, todayIso } from '@/lib/farm/format';
import { INCIDENT_TYPES, optionLabel } from '@/lib/farm/schemas';
import type { IncidentRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 7;

function IncidentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useFarmAccess();
  const blocks = useBlocks();
  const [creating, setCreating] = useState(searchParams.get('new') === '1');
  const [scope, setScope] = useState<'open' | 'all'>('open');
  const [blockId, setBlockId] = useState(searchParams.get('block_id') ?? ALL);
  const [type, setType] = useState(ALL);

  const params = new URLSearchParams();
  if (scope === 'open') params.set('status', 'open');
  if (blockId !== ALL) params.set('block_id', blockId);
  const qs = params.toString();

  const incidents = useQuery({
    queryKey: [...farmKeys.incidents, qs],
    queryFn: () => farmFetch<{ incidents: IncidentRow[] }>(`/api/farm/incidents?${qs}`).then((r) => r.incidents),
  });

  const filtered = useMemo(() => (incidents.data ?? []).filter((i) => type === ALL || i.incident_type === type), [incidents.data, type]);
  const today = todayIso();
  const stats = useMemo(
    () => ({
      unresolved: filtered.filter((i) => i.status !== 'resolved').length,
      severe: filtered.filter((i) => i.status !== 'resolved' && (i.severity === 'high' || i.severity === 'critical')).length,
      followUpDue: filtered.filter((i) => i.status !== 'resolved' && i.follow_up_date && i.follow_up_date <= today).length,
    }),
    [filtered, today]
  );
  const createDefaults = useMemo(() => (blockId !== ALL ? { block_id: blockId } : undefined), [blockId]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pest & Disease"
        subtitle="Outbreaks found in the field, treatment and follow-up."
        actions={
          can('pest.record') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Report incident
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Unresolved" value={stats.unresolved} />
        <KpiCard label="High or critical" value={stats.severe} hint="Unresolved" />
        <KpiCard label="Follow-up due" value={stats.followUpDue} hint="On or before today" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={scope} onValueChange={(v) => setScope(v as 'open' | 'all')}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Unresolved</SelectItem>
            <SelectItem value="all">All incidents</SelectItem>
          </SelectContent>
        </Select>
        <Select value={blockId} onValueChange={setBlockId}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All blocks</SelectItem>
            {(blocks.data ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.code} · {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {INCIDENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {optionLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {incidents.error ? (
        <ErrorState message={errorMessage(incidents.error)} onRetry={() => incidents.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identified</TableHead>
                <TableHead>Pest / disease</TableHead>
                <TableHead>Block / crop</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Area</TableHead>
                <TableHead>Follow up</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title={scope === 'open' ? 'No unresolved incidents' : 'No incidents recorded'}
                  action={
                    can('pest.record') ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> Report incident
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((i) => {
                  const due = i.status !== 'resolved' && i.follow_up_date && i.follow_up_date <= today;
                  return (
                    <TableRow key={i.id} className="cursor-pointer" onClick={() => router.push(`/farm/incidents/${i.id}`)}>
                      <TableCell className="whitespace-nowrap">{fmtDate(i.date_identified)}</TableCell>
                      <TableCell>
                        <Link
                          href={`/farm/incidents/${i.id}`}
                          className="font-semibold text-brand-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {i.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{optionLabel(i.incident_type)}</p>
                      </TableCell>
                      <TableCell>
                        {i.block?.code}
                        <p className="text-xs text-muted-foreground">{i.crop?.name ?? '—'}</p>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={i.severity} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtHa(i.area_affected_ha)}</TableCell>
                      <TableCell className={due ? 'font-medium whitespace-nowrap text-red-700' : 'whitespace-nowrap'}>
                        {fmtDate(i.follow_up_date)}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={i.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <IncidentFormSheet
        open={creating}
        onOpenChange={setCreating}
        defaults={createDefaults}
        onSaved={(i) => router.push(`/farm/incidents/${i.id}`)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="pest.view">
      <Suspense>
        <IncidentsPage />
      </Suspense>
    </RequirePermission>
  );
}

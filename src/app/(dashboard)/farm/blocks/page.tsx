'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { BlockFormSheet } from '@/components/farm/forms/BlockFormSheet';
import { farmKeys, useCrops } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtHa, fmtNumber, fmtQty } from '@/lib/farm/format';
import { BLOCK_STATUSES, optionLabel } from '@/lib/farm/schemas';
import type { BlockRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 8;

function BlocksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useFarmAccess();
  const crops = useCrops();
  const [creating, setCreating] = useState(searchParams.get('new') === '1');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const [cropId, setCropId] = useState(ALL);

  const blocks = useQuery({
    queryKey: farmKeys.blocks,
    queryFn: () => farmFetch<{ blocks: BlockRow[] }>('/api/farm/blocks').then((r) => r.blocks),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (blocks.data ?? []).filter((b) => {
      if (status !== ALL && b.status !== status) return false;
      if (cropId !== ALL && b.current_cycle?.crop_id !== cropId) return false;
      if (q && !`${b.code} ${b.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [blocks.data, search, status, cropId]);

  const totalArea = filtered.reduce((sum, b) => sum + Number(b.area_ha), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blocks"
        subtitle="Plots on the farm, what is planted in each and the expected harvest."
        actions={
          can('farm.manage') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New block
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search block ID or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {BLOCK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {optionLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cropId} onValueChange={setCropId}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All crops</SelectItem>
            {(crops.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} block{filtered.length === 1 ? '' : 's'} · {fmtHa(totalArea)}
        </p>
      </div>

      {blocks.error ? (
        <ErrorState message={errorMessage(blocks.error)} onRetry={() => blocks.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Crop / variety</TableHead>
                <TableHead>Planted</TableHead>
                <TableHead>Expected harvest</TableHead>
                <TableHead className="text-right">Expected / actual yield</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title={blocks.data?.length ? 'No blocks match these filters' : 'No blocks yet'}
                  description={blocks.data?.length ? undefined : 'Add the blocks or plots that make up the farm.'}
                  action={
                    !blocks.data?.length && can('farm.manage') ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> New block
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((b) => {
                  const c = b.current_cycle;
                  return (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => router.push(`/farm/blocks/${b.id}`)}>
                      <TableCell>
                        <Link
                          href={`/farm/blocks/${b.id}`}
                          className="font-semibold text-brand-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {b.code}
                        </Link>
                        <p className="text-xs text-muted-foreground">{b.name}</p>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fmtNumber(b.size_value)} {b.size_unit}
                        {b.size_unit === 'acres' ? (
                          <p className="text-xs text-muted-foreground">{fmtHa(b.area_ha)}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {c ? (
                          <>
                            <span className="font-medium">{c.crop?.name}</span>
                            {c.variety ? <p className="text-xs text-muted-foreground">{c.variety.name}</p> : null}
                            {c.status === 'planned' ? <StatusChip status="planned" className="mt-1" /> : null}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Not planted</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(c?.planting_date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(c?.expected_harvest_date)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {c ? (
                          <>
                            {fmtQty(c.expected_yield, c.yield_unit)}
                            <p className="text-xs text-muted-foreground">{fmtQty(c.actual_yield, c.yield_unit)} harvested</p>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{b.supervisor?.full_name ?? '—'}</TableCell>
                      <TableCell>
                        <StatusChip status={b.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <BlockFormSheet
        open={creating}
        onOpenChange={setCreating}
        onSaved={(block) => router.push(`/farm/blocks/${block.id}`)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="farm.view">
      <Suspense>
        <BlocksPage />
      </Suspense>
    </RequirePermission>
  );
}

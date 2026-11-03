'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { ContractFormSheet } from '@/components/farm/forms/ContractFormSheet';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/farm/format';
import { CONTRACT_STATUSES, optionLabel } from '@/lib/farm/schemas';
import type { BuyerRow, ContractRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 8;

function ContractsPage() {
  const { can } = useFarmAccess();
  const canManage = can('contracts.manage');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ContractRow | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const [buyerId, setBuyerId] = useState(ALL);

  const buyers = useQuery({
    queryKey: farmKeys.buyers,
    queryFn: () => farmFetch<{ buyers: BuyerRow[] }>('/api/farm/buyers').then((r) => r.buyers),
  });
  const contracts = useQuery({
    queryKey: farmKeys.contracts,
    queryFn: () => farmFetch<{ contracts: ContractRow[] }>('/api/farm/contracts').then((r) => r.contracts),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (contracts.data ?? []).filter((c) => {
      if (status !== ALL && c.status !== status) return false;
      if (buyerId !== ALL && c.buyer_id !== buyerId) return false;
      if (q && !`${c.contract_no} ${c.title} ${c.buyer?.name ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contracts.data, search, status, buyerId]);

  const totals = useMemo(() => {
    const all = contracts.data ?? [];
    return {
      active: all.filter((c) => c.status === 'active').length,
      draft: all.filter((c) => c.status === 'draft').length,
      value: all
        .filter((c) => c.status === 'active' || c.status === 'draft')
        .reduce((sum, c) => sum + Number(c.agreed_quantity) * Number(c.unit_price), 0),
    };
  }, [contracts.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contracts"
        subtitle="Supply agreements with buyers — quantity, price and crop specs."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New contract
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Active contracts" value={totals.active} />
        <KpiCard label="Draft" value={totals.draft} />
        <KpiCard label="Open contract value" value={fmtMoney(totals.value)} hint="Draft + active, agreed qty × price" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search contract or buyer"
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
            {CONTRACT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {optionLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={buyerId} onValueChange={setBuyerId}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All buyers</SelectItem>
            {(buyers.data ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} contract{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      {contracts.error ? (
        <ErrorState message={errorMessage(contracts.error)} onRetry={() => contracts.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Crop / grade</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title={contracts.data?.length ? 'No contracts match these filters' : 'No contracts yet'}
                  description={
                    contracts.data?.length ? undefined : 'Create a supply contract once you have a buyer on file.'
                  }
                  action={
                    !contracts.data?.length && canManage ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> New contract
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-mono text-sm font-semibold">{c.contract_no}</p>
                      <p className="text-xs text-muted-foreground">{c.title}</p>
                    </TableCell>
                    <TableCell>{c.buyer?.name ?? '—'}</TableCell>
                    <TableCell>
                      {c.crop?.name ?? 'Any'}
                      {c.grade ? <p className="text-xs text-muted-foreground">{c.grade.name}</p> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {fmtDate(c.start_date)}
                      {c.end_date ? ` – ${fmtDate(c.end_date)}` : ''}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {fmtNumber(c.agreed_quantity)} {c.quantity_unit}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {fmtMoney(c.unit_price, c.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={c.status} />
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${c.contract_no}`}
                          onClick={() => setEditing(c)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ContractFormSheet open={creating} onOpenChange={setCreating} buyers={buyers.data ?? []} />
      <ContractFormSheet
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        contract={editing}
        buyers={buyers.data ?? []}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="contracts.view">
      <ContractsPage />
    </RequirePermission>
  );
}

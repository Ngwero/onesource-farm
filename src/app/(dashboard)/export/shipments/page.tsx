'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackagePlus, Pencil, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { ShipmentFormSheet } from '@/components/farm/forms/ShipmentFormSheet';
import { ShipmentLineFormSheet } from '@/components/farm/forms/ShipmentLineFormSheet';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/farm/format';
import { SHIPMENT_STATUSES, optionLabel } from '@/lib/farm/schemas';
import type { BuyerRow, ContractRow, ShipmentRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 9;

function ShipmentsPage() {
  const { can } = useFarmAccess();
  const canManage = can('shipments.manage');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ShipmentRow | null>(null);
  const [allocating, setAllocating] = useState<ShipmentRow | null>(null);
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
  const shipments = useQuery({
    queryKey: farmKeys.shipments,
    queryFn: () => farmFetch<{ shipments: ShipmentRow[] }>('/api/farm/shipments').then((r) => r.shipments),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (shipments.data ?? []).filter((s) => {
      if (status !== ALL && s.status !== status) return false;
      if (buyerId !== ALL && s.buyer_id !== buyerId) return false;
      if (
        q &&
        !`${s.shipment_no} ${s.buyer?.name ?? ''} ${s.awb_bl_number ?? ''} ${s.destination ?? ''}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [shipments.data, search, status, buyerId]);

  const totals = useMemo(() => {
    const all = shipments.data ?? [];
    const open = all.filter((s) => !['cancelled', 'delivered'].includes(s.status));
    const kg = all.reduce(
      (sum, s) => sum + (s.lines ?? []).reduce((lineSum, l) => lineSum + Number(l.net_weight), 0),
      0
    );
    const invoiced = all.reduce((sum, s) => sum + Number(s.invoice_amount ?? 0), 0);
    return { open: open.length, kg, invoiced };
  }, [shipments.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shipments"
        subtitle="Export shipments, AWBs and allocated packing batches."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New shipment
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Open shipments" value={totals.open} hint="Not delivered or cancelled" />
        <KpiCard label="Allocated weight" value={`${fmtNumber(totals.kg)} kg`} />
        <KpiCard label="Invoiced" value={fmtMoney(totals.invoiced)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search shipment, buyer or AWB"
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
            {SHIPMENT_STATUSES.map((s) => (
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
          {filtered.length} shipment{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      {shipments.error ? (
        <ErrorState message={errorMessage(shipments.error)} onRetry={() => shipments.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>ETD / ETA</TableHead>
                <TableHead className="text-right">Lines / kg</TableHead>
                <TableHead className="text-right">Invoice</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title={shipments.data?.length ? 'No shipments match these filters' : 'No shipments yet'}
                  description={
                    shipments.data?.length
                      ? undefined
                      : 'Create a shipment, then allocate packing batches from the warehouse.'
                  }
                  action={
                    !shipments.data?.length && canManage ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> New shipment
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((s) => {
                  const lineKg = (s.lines ?? []).reduce((sum, l) => sum + Number(l.net_weight), 0);
                  const lineCount = s.lines?.length ?? 0;
                  const canAllocate = canManage && !['cancelled', 'delivered'].includes(s.status);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="font-mono text-sm font-semibold">{s.shipment_no}</p>
                        {s.awb_bl_number ? (
                          <p className="text-xs text-muted-foreground">AWB {s.awb_bl_number}</p>
                        ) : null}
                        {s.contract ? (
                          <p className="text-xs text-muted-foreground">{s.contract.contract_no}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>{s.buyer?.name ?? '—'}</TableCell>
                      <TableCell>{s.destination ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {fmtDate(s.etd)}
                        {s.eta ? <p className="text-xs text-muted-foreground">ETA {fmtDate(s.eta)}</p> : null}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {lineCount} line{lineCount === 1 ? '' : 's'}
                        <p className="text-xs text-muted-foreground">{fmtNumber(lineKg)} kg</p>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {s.invoice_amount != null ? fmtMoney(s.invoice_amount, s.invoice_currency) : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={s.payment_status} />
                      </TableCell>
                      <TableCell>
                        <StatusChip status={s.status} />
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <div className="flex items-center justify-end gap-1">
                            {canAllocate ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Allocate to ${s.shipment_no}`}
                                onClick={() => setAllocating(s)}
                              >
                                <PackagePlus className="size-4" />
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${s.shipment_no}`}
                              onClick={() => setEditing(s)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </div>
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

      <ShipmentFormSheet
        open={creating}
        onOpenChange={setCreating}
        buyers={buyers.data ?? []}
        contracts={contracts.data ?? []}
      />
      <ShipmentFormSheet
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        shipment={editing}
        buyers={buyers.data ?? []}
        contracts={contracts.data ?? []}
      />
      {allocating ? (
        <ShipmentLineFormSheet
          open
          onOpenChange={(o) => !o && setAllocating(null)}
          shipment={allocating}
          onSaved={() => setAllocating(null)}
        />
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="shipments.view">
      <ShipmentsPage />
    </RequirePermission>
  );
}

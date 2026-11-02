'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, History, MoreHorizontal, PackageX, Truck, Warehouse } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { KpiCard } from '@/components/farm/KpiCard';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { QcStatusChip } from '@/components/farm/StatusChip';
import { StockMovementSheet, type MovementKind } from '@/components/farm/forms/StockMovementSheet';
import { farmKeys, useWarehouseLocations } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate, fmtNumber } from '@/lib/farm/format';
import type { PackingBatchRow } from '@/lib/farm/types';

const ALL = 'all';
type View = 'received' | 'awaiting';

function onHand(b: PackingBatchRow) {
  return b.stock.available + b.stock.reserved;
}

function InventoryPage() {
  const { can } = useFarmAccess();
  const canManage = can('warehouse.manage');
  const locations = useWarehouseLocations();
  const [view, setView] = useState<View>('received');
  const [locationId, setLocationId] = useState(ALL);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [action, setAction] = useState<{ batch: PackingBatchRow; kind: MovementKind } | null>(null);

  const params = new URLSearchParams();
  if (view === 'awaiting') params.set('view', 'awaiting');
  if (view === 'received' && locationId !== ALL) params.set('location_id', locationId);
  const qs = params.toString();

  const stock = useQuery({
    queryKey: [...farmKeys.stock, qs],
    queryFn: () => farmFetch<{ batches: PackingBatchRow[] }>(`/api/farm/warehouse/stock?${qs}`).then((r) => r.batches),
  });
  const all = useMemo(() => stock.data ?? [], [stock.data]);
  const list = useMemo(
    () => (view === 'received' && inStockOnly ? all.filter((b) => onHand(b) > 0) : all),
    [all, view, inStockOnly]
  );

  const totals = useMemo(() => {
    const kg = (b: PackingBatchRow, n: number) => n * Number(b.net_weight_per_package);
    const byProduct = new Map<string, { crop: string; grade: string; batches: number; available: number; reserved: number; availableKg: number; reservedKg: number }>();
    let available = 0;
    let reserved = 0;
    let dispatched = 0;
    let lost = 0;
    let awaitingRelease = 0;
    for (const b of all) {
      if (!b.received_date) continue;
      available += kg(b, b.stock.available);
      reserved += kg(b, b.stock.reserved);
      dispatched += kg(b, b.stock.dispatched);
      lost += kg(b, b.stock.damaged + b.stock.spoiled);
      if (b.qc_status !== 'released') awaitingRelease += kg(b, onHand(b));
      if (onHand(b) === 0) continue;
      const key = `${b.crop_id}:${b.grade_id}`;
      const row = byProduct.get(key) ?? {
        crop: b.crop?.name ?? '—',
        grade: b.grade?.name ?? '—',
        batches: 0,
        available: 0,
        reserved: 0,
        availableKg: 0,
        reservedKg: 0,
      };
      row.batches += 1;
      row.available += b.stock.available;
      row.reserved += b.stock.reserved;
      row.availableKg += kg(b, b.stock.available);
      row.reservedKg += kg(b, b.stock.reserved);
      byProduct.set(key, row);
    }
    const products = [...byProduct.values()].sort((a, b) => a.crop.localeCompare(b.crop) || a.grade.localeCompare(b.grade));
    return { available, reserved, dispatched, lost, awaitingRelease, products };
  }, [all]);

  const columns = view === 'received' ? 9 : 6;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Warehouse Inventory"
        subtitle="Packed stock by batch and location. Every receipt, move, loss and dispatch is kept in the stock movement ledger."
        actions={
          <Button variant="outline" asChild>
            <Link href="/warehouse/movements">
              <History className="size-4" /> Movement history
            </Link>
          </Button>
        }
      />

      {view === 'received' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Available" value={`${fmtNumber(totals.available)} kg`} hint="On hand, free to allocate" />
          <KpiCard label="Reserved" value={`${fmtNumber(totals.reserved)} kg`} hint="Held for contracts" />
          <KpiCard label="Not yet released" value={`${fmtNumber(totals.awaitingRelease)} kg`} hint="On hand, awaiting QC release" />
          <KpiCard label="Dispatched" value={`${fmtNumber(totals.dispatched)} kg`} />
          <KpiCard label="Damaged / spoiled" value={`${fmtNumber(totals.lost)} kg`} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="received">In warehouse</TabsTrigger>
            <TabsTrigger value="awaiting">Awaiting receipt</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === 'received' ? (
          <>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All locations</SelectItem>
                {(locations.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={inStockOnly} onCheckedChange={setInStockOnly} />
              Hide batches with no stock left
            </label>
          </>
        ) : null}
      </div>

      {view === 'received' && totals.products.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock on hand by product</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Crop</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="pr-6 text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.products.map((p) => (
                  <TableRow key={`${p.crop}:${p.grade}`}>
                    <TableCell className="pl-6 font-medium">{p.crop}</TableCell>
                    <TableCell>{p.grade}</TableCell>
                    <TableCell className="text-right">{p.batches}</TableCell>
                    <TableCell className="text-right">
                      {fmtNumber(p.availableKg)} kg
                      <p className="text-xs text-muted-foreground">{p.available} pkgs</p>
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtNumber(p.reservedKg)} kg
                      <p className="text-xs text-muted-foreground">{p.reserved} pkgs</p>
                    </TableCell>
                    <TableCell className="pr-6 text-right font-semibold">{fmtNumber(p.availableKg + p.reservedKg)} kg</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {stock.error ? (
        <ErrorState message={errorMessage(stock.error)} onRetry={() => stock.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Packed batch</TableHead>
                <TableHead>Packaging</TableHead>
                {view === 'received' ? (
                  <>
                    <TableHead>Location</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Out / lost</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Packed</TableHead>
                    <TableHead className="text-right">Net weight</TableHead>
                  </>
                )}
                <TableHead>QC</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.isLoading ? (
                <LoadingRows columns={columns} />
              ) : list.length === 0 ? (
                <EmptyRow
                  columns={columns}
                  title={view === 'received' ? 'No stock in the warehouse' : 'Nothing waiting to be received'}
                  description={
                    view === 'received'
                      ? 'Packed batches appear here once they are received at a warehouse location.'
                      : 'New packed batches wait here until the store receives them.'
                  }
                />
              ) : (
                list.map((b) => {
                  const perPackage = Number(b.net_weight_per_package);
                  const released = b.qc_status === 'released';
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link href={`/packhouse/packing/${b.id}`} className="font-mono text-sm font-semibold text-brand-700 hover:underline">
                          {b.packing_no}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {b.crop?.name} · {b.grade?.name}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {b.package_count} × {b.packaging?.name}
                        <p className="text-xs text-muted-foreground">{fmtNumber(perPackage)} kg each</p>
                      </TableCell>
                      {view === 'received' ? (
                        <>
                          <TableCell>{b.location?.name ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDate(b.received_date)}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold">{b.stock.available}</span>
                            <p className="text-xs text-muted-foreground">{fmtNumber(b.stock.available * perPackage)} kg</p>
                          </TableCell>
                          <TableCell className="text-right">{b.stock.reserved || '—'}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {b.stock.dispatched} sent
                            {b.stock.damaged + b.stock.spoiled ? ` · ${b.stock.damaged + b.stock.spoiled} lost` : ''}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="whitespace-nowrap">{fmtDate(b.packing_date)}</TableCell>
                          <TableCell className="text-right">{fmtNumber(b.net_weight)} kg</TableCell>
                        </>
                      )}
                      <TableCell>
                        <QcStatusChip status={b.qc_status} />
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          view === 'awaiting' ? (
                            <Button size="sm" variant="outline" onClick={() => setAction({ batch: b, kind: 'receive' })}>
                              <Warehouse className="size-4" /> Receive
                            </Button>
                          ) : onHand(b) > 0 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={`Actions for ${b.packing_no}`}>
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {released && b.stock.available > 0 ? (
                                  <DropdownMenuItem onSelect={() => setAction({ batch: b, kind: 'dispatch' })}>
                                    <Truck className="size-4" /> Dispatch
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem onSelect={() => setAction({ batch: b, kind: 'relocate' })}>
                                  <ArrowRightLeft className="size-4" /> Move location
                                </DropdownMenuItem>
                                {b.stock.available > 0 ? (
                                  <>
                                    <DropdownMenuItem onSelect={() => setAction({ batch: b, kind: 'damage' })}>
                                      <PackageX className="size-4" /> Record damaged
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setAction({ batch: b, kind: 'spoil' })}>
                                      <PackageX className="size-4" /> Record spoiled
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null
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

      {action ? (
        <StockMovementSheet open onOpenChange={(o) => !o && setAction(null)} batch={action.batch} kind={action.kind} />
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="warehouse.view">
      <InventoryPage />
    </RequirePermission>
  );
}

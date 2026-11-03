'use client';

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { InputLotFormSheet } from '@/components/farm/forms/InputLotFormSheet';
import { useCurrency, useInputLots, useInputProducts } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage } from '@/lib/farm/client';
import { fmtDate, fmtMoney } from '@/lib/farm/format';
import type { InputLotRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 7;

function LotsPage() {
  const { can } = useFarmAccess();
  const currency = useCurrency();
  const products = useInputProducts();
  const lots = useInputLots();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InputLotRow | null>(null);
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState(ALL);
  const [stock, setStock] = useState('in_stock');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (lots.data ?? []).filter((l) => {
      if (productId !== ALL && l.product_id !== productId) return false;
      if (stock === 'in_stock' && Number(l.quantity_remaining) <= 0) return false;
      if (stock === 'empty' && Number(l.quantity_remaining) > 0) return false;
      const hay = `${l.lot_no} ${l.product?.name ?? ''} ${l.product?.sku ?? ''} ${l.supplier ?? ''}`;
      if (q && !hay.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lots.data, search, productId, stock]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lots & stock"
        subtitle="Received batches with remaining quantity. Field activities can issue from a lot."
        actions={
          can('procurement.manage') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Receive lot
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search lot, product or supplier"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All products</SelectItem>
            {(products.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stock} onValueChange={setStock}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in_stock">In stock</SelectItem>
            <SelectItem value="empty">Empty</SelectItem>
            <SelectItem value={ALL}>All lots</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} lot{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      {lots.error ? (
        <ErrorState message={errorMessage(lots.error)} onRetry={() => lots.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title={lots.data?.length ? 'No lots match these filters' : 'No lots received yet'}
                  description={
                    lots.data?.length ? undefined : 'Receive a delivery to start tracking quantity remaining.'
                  }
                  action={
                    !lots.data?.length && can('procurement.manage') ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> Receive lot
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((l) => (
                  <TableRow
                    key={l.id}
                    className={can('procurement.manage') ? 'cursor-pointer' : undefined}
                    onClick={() => can('procurement.manage') && setEditing(l)}
                  >
                    <TableCell>
                      <p className="font-semibold">{l.lot_no}</p>
                      <p className="text-xs text-muted-foreground">{l.supplier || '—'}</p>
                    </TableCell>
                    <TableCell>
                      <p>{l.product?.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{l.product?.sku}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(l.received_date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.expiry_date ? fmtDate(l.expiry_date) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {Number(l.quantity_remaining)} / {Number(l.quantity_received)} {l.product?.unit ?? ''}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {l.unit_cost == null ? '—' : fmtMoney(l.unit_cost, currency)}
                    </TableCell>
                    <TableCell>{l.location || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <InputLotFormSheet open={creating} onOpenChange={setCreating} />
      <InputLotFormSheet open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} lot={editing} />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="procurement.view">
      <LotsPage />
    </RequirePermission>
  );
}

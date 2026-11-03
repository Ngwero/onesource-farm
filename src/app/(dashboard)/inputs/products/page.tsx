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
import { StatusChip } from '@/components/farm/StatusChip';
import { InputProductFormSheet } from '@/components/farm/forms/InputProductFormSheet';
import { useInputProducts } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage } from '@/lib/farm/client';
import { INPUT_PRODUCT_CATEGORIES, optionLabel } from '@/lib/farm/schemas';
import type { InputProductRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 7;

function ProductsPage() {
  const { can } = useFarmAccess();
  const products = useInputProducts();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InputProductRow | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState(ALL);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products.data ?? []).filter((p) => {
      if (status !== ALL && p.status !== status) return false;
      if (category !== ALL && p.category !== category) return false;
      if (q && !`${p.sku} ${p.name} ${p.active_ingredient ?? ''} ${p.manufacturer ?? ''}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [products.data, search, status, category]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Input store"
        subtitle="Products held for field use — seed, fertilizer, crop protection, fuel and packaging."
        actions={
          can('procurement.manage') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New product
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search SKU, name or AI"
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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {INPUT_PRODUCT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {optionLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} product{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      {products.error ? (
        <ErrorState message={errorMessage(products.error)} onRetry={() => products.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Active ingredient</TableHead>
                <TableHead>Reorder at</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title={products.data?.length ? 'No products match these filters' : 'No input products yet'}
                  description={
                    products.data?.length
                      ? undefined
                      : 'Add products so field activities can draw stock from named lots.'
                  }
                  action={
                    !products.data?.length && can('procurement.manage') ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> New product
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className={can('procurement.manage') ? 'cursor-pointer' : undefined}
                    onClick={() => can('procurement.manage') && setEditing(p)}
                  >
                    <TableCell>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku}</p>
                    </TableCell>
                    <TableCell>{optionLabel(p.category)}</TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell className="max-w-[12rem] truncate">{p.active_ingredient || '—'}</TableCell>
                    <TableCell className="tabular-nums">{Number(p.reorder_level)}</TableCell>
                    <TableCell>{p.default_supplier || '—'}</TableCell>
                    <TableCell>
                      <StatusChip status={p.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <InputProductFormSheet open={creating} onOpenChange={setCreating} />
      <InputProductFormSheet open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)} product={editing} />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="procurement.view">
      <ProductsPage />
    </RequirePermission>
  );
}

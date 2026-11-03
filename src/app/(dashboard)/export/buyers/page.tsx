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
import { BuyerFormSheet } from '@/components/farm/forms/BuyerFormSheet';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import type { BuyerRow } from '@/lib/farm/types';

const ALL = 'all';
const COLUMNS = 7;

function BuyersPage() {
  const { can } = useFarmAccess();
  const canManage = can('buyers.manage');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BuyerRow | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');

  const buyers = useQuery({
    queryKey: farmKeys.buyers,
    queryFn: () => farmFetch<{ buyers: BuyerRow[] }>('/api/farm/buyers').then((r) => r.buyers),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (buyers.data ?? []).filter((b) => {
      if (status !== ALL && b.status !== status) return false;
      if (
        q &&
        !`${b.code} ${b.name} ${b.contact_name ?? ''} ${b.country ?? ''} ${b.destination ?? ''}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [buyers.data, search, status]);

  const totals = useMemo(() => {
    const all = buyers.data ?? [];
    return {
      active: all.filter((b) => b.status === 'active').length,
      inactive: all.filter((b) => b.status === 'inactive').length,
      countries: new Set(all.map((b) => b.country).filter(Boolean)).size,
    };
  }, [buyers.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Buyers"
        subtitle="Export customers, destinations and payment terms."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New buyer
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Active buyers" value={totals.active} />
        <KpiCard label="Inactive" value={totals.inactive} />
        <KpiCard label="Countries" value={totals.countries} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search code, name or destination"
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
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} buyer{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      {buyers.error ? (
        <ErrorState message={errorMessage(buyers.error)} onRetry={() => buyers.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Payment terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {buyers.isLoading ? (
                <LoadingRows columns={COLUMNS} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  columns={COLUMNS}
                  title={buyers.data?.length ? 'No buyers match these filters' : 'No buyers yet'}
                  description={buyers.data?.length ? undefined : 'Add the export customers you ship to.'}
                  action={
                    !buyers.data?.length && canManage ? (
                      <Button onClick={() => setCreating(true)}>
                        <Plus className="size-4" /> New buyer
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <p className="font-mono text-sm font-semibold">{b.code}</p>
                      <p className="text-sm">{b.name}</p>
                    </TableCell>
                    <TableCell>
                      {b.contact_name ?? '—'}
                      {b.email ? <p className="text-xs text-muted-foreground">{b.email}</p> : null}
                    </TableCell>
                    <TableCell>{b.country ?? '—'}</TableCell>
                    <TableCell>{b.destination ?? '—'}</TableCell>
                    <TableCell>{b.payment_terms ?? '—'}</TableCell>
                    <TableCell>
                      <StatusChip status={b.status} />
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${b.name}`}
                          onClick={() => setEditing(b)}
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

      <BuyerFormSheet open={creating} onOpenChange={setCreating} />
      <BuyerFormSheet
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        buyer={editing}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="buyers.view">
      <BuyersPage />
    </RequirePermission>
  );
}

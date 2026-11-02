'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/farm/DataStates';
import { MovementTable } from '@/components/farm/Packhouse';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { farmKeys } from '@/hooks/farm';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { MOVEMENT_TYPES } from '@/lib/farm/schemas';
import type { StockMovementRow } from '@/lib/farm/types';

const ALL = 'all';
const TYPE_LABEL: Record<(typeof MOVEMENT_TYPES)[number], string> = {
  receive: 'Received',
  relocate: 'Moved',
  damage: 'Damaged',
  spoil: 'Spoiled',
  dispatch: 'Dispatched',
};

function MovementsPage() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState('');
  const [type, setType] = useState(ALL);

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (type !== ALL) params.set('type', type);
  const qs = params.toString();

  const movements = useQuery({
    queryKey: [...farmKeys.movements, qs],
    queryFn: () => farmFetch<{ movements: StockMovementRow[] }>(`/api/farm/warehouse/movements?${qs}`).then((r) => r.movements),
  });

  return (
    <div className="space-y-5">
      <Link href="/warehouse/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Warehouse Inventory
      </Link>
      <PageHeader
        title="Stock Movements"
        subtitle="The permanent ledger of every receipt, move, loss and dispatch. Entries cannot be edited or deleted."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input type="date" className="w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" className="w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All movements</SelectItem>
            {MOVEMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {movements.error ? (
        <ErrorState message={errorMessage(movements.error)} onRetry={() => movements.refetch()} />
      ) : movements.isLoading ? (
        <div className="dashboard-loading">Loading movements…</div>
      ) : (
        <div className="data-table">
          <MovementTable movements={movements.data ?? []} showBatch />
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="warehouse.view">
      <MovementsPage />
    </RequirePermission>
  );
}

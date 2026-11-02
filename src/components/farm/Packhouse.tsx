import Link from 'next/link';
import { Check, Minus, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyRow } from '@/components/farm/DataStates';
import { StatusChip } from '@/components/farm/StatusChip';
import { fmtDate, fmtNumber } from '@/lib/farm/format';
import { optionLabel } from '@/lib/farm/schemas';
import type { QcCheckRow, QcInspectionRow, StockBalance, StockMovementRow } from '@/lib/farm/types';

const BUCKETS: { key: keyof StockBalance; label: string; colour: string }[] = [
  { key: 'available', label: 'Available', colour: 'bg-emerald-500' },
  { key: 'reserved', label: 'Reserved', colour: 'bg-sky-500' },
  { key: 'dispatched', label: 'Dispatched', colour: 'bg-lime-500' },
  { key: 'damaged', label: 'Damaged', colour: 'bg-amber-500' },
  { key: 'spoiled', label: 'Spoiled', colour: 'bg-red-500' },
];

/** Package balances as a stacked bar with counts and net weight per state. */
export function StockBreakdown({ stock, total, kgPerPackage }: { stock: StockBalance; total: number; kgPerPackage: number }) {
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {BUCKETS.map((b) =>
          stock[b.key] > 0 ? <div key={b.key} className={b.colour} style={{ width: `${(stock[b.key] / Math.max(total, 1)) * 100}%` }} /> : null
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {BUCKETS.map((b) => (
          <div key={b.key}>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`size-2 rounded-full ${b.colour}`} /> {b.label}
            </dt>
            <dd className="text-sm font-semibold">
              {stock[b.key]} <span className="font-normal text-muted-foreground">· {fmtNumber(stock[b.key] * kgPerPackage)} kg</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function movementSummary(m: StockMovementRow): string {
  switch (m.movement_type) {
    case 'receive':
      return `Received into ${m.to_location?.name ?? 'warehouse'}`;
    case 'relocate':
      return `Moved ${m.from_location?.name ?? ''} → ${m.to_location?.name ?? ''}`;
    case 'dispatch':
      return `Dispatched${m.reference ? ` · ${m.reference}` : ''}`;
    case 'damage':
      return 'Written off as damaged';
    case 'spoil':
      return 'Written off as spoiled';
    default:
      return optionLabel(m.movement_type);
  }
}

export function MovementTable({ movements, showBatch = false }: { movements: StockMovementRow[]; showBatch?: boolean }) {
  const columns = showBatch ? 7 : 6;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Date</TableHead>
          {showBatch ? <TableHead>Packed batch</TableHead> : null}
          <TableHead>Movement</TableHead>
          <TableHead className="text-right">Packages</TableHead>
          <TableHead className="text-right">Net weight</TableHead>
          <TableHead>Details</TableHead>
          <TableHead className="pr-6">By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.length === 0 ? (
          <EmptyRow columns={columns} title="No stock movements yet" />
        ) : (
          movements.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="pl-6 whitespace-nowrap">{fmtDate(m.movement_date)}</TableCell>
              {showBatch ? (
                <TableCell>
                  {m.batch ? (
                    <Link href={`/packhouse/packing/${m.batch.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                      {m.batch.packing_no}
                    </Link>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {m.batch?.crop?.name} {m.batch?.grade ? `· ${m.batch.grade.name}` : ''}
                  </p>
                </TableCell>
              ) : null}
              <TableCell>
                <StatusChip status={m.movement_type} />
              </TableCell>
              <TableCell className="text-right">{m.packages}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {m.batch ? `${fmtNumber(m.packages * Number(m.batch.net_weight_per_package))} kg` : '—'}
              </TableCell>
              <TableCell className="max-w-72">
                <p className="text-sm">{movementSummary(m)}</p>
                {m.reason ? <p className="text-xs text-muted-foreground">{m.reason}</p> : null}
                {m.reference && m.movement_type !== 'dispatch' ? <p className="text-xs text-muted-foreground">Ref {m.reference}</p> : null}
              </TableCell>
              <TableCell className="pr-6 text-sm text-muted-foreground">{m.created_by_user?.full_name ?? '—'}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function InspectionTable({ inspections, emptyTitle = 'No inspections yet' }: { inspections: QcInspectionRow[]; emptyTitle?: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Inspection</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Checks</TableHead>
          <TableHead>Review</TableHead>
          <TableHead className="pr-6">Inspector</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {inspections.length === 0 ? (
          <EmptyRow columns={6} title={emptyTitle} />
        ) : (
          inspections.map((i) => {
            const failed = i.checks.filter((c) => c.passed === false).length;
            return (
              <TableRow key={i.id}>
                <TableCell className="pl-6">
                  <Link href={`/quality/inspections/${i.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                    {i.inspection_no}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(i.inspection_date)}</TableCell>
                <TableCell>
                  <StatusChip status={i.result} />
                </TableCell>
                <TableCell className="text-sm">
                  {i.checks.length - failed}/{i.checks.length} passed
                </TableCell>
                <TableCell>
                  <StatusChip status={i.review_status} label={i.review_status === 'rework' && i.rework_completed_at ? 'Rework done' : undefined} />
                </TableCell>
                <TableCell className="pr-6 text-sm text-muted-foreground">{i.inspector?.full_name ?? '—'}</TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

function CheckValue({ c }: { c: QcCheckRow }) {
  if (c.criterion_type === 'numeric' || c.criterion_type === 'scale') {
    return c.value_numeric == null ? '—' : `${fmtNumber(c.value_numeric, 4)}${c.unit ? ` ${c.unit}` : ''}`;
  }
  if (c.criterion_type === 'text') return c.value_text ?? '—';
  return null;
}

export function ChecksTable({ checks }: { checks: QcCheckRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Check</TableHead>
          <TableHead>Specification</TableHead>
          <TableHead>Measured</TableHead>
          <TableHead className="pr-6">Outcome</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {checks.length === 0 ? (
          <EmptyRow columns={4} title="No checks recorded" />
        ) : (
          checks.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="pl-6 font-medium">
                {c.name}
                {c.is_mandatory ? <span className="text-destructive">*</span> : null}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.min_value != null || c.max_value != null
                  ? `${c.min_value != null ? fmtNumber(c.min_value) : '…'} – ${c.max_value != null ? fmtNumber(c.max_value) : '…'}${c.unit ? ` ${c.unit}` : ''}`
                  : c.criterion_type === 'pass_fail'
                    ? 'Visual pass / fail'
                    : optionLabel(c.criterion_type)}
              </TableCell>
              <TableCell className="text-sm">
                <CheckValue c={c} />
              </TableCell>
              <TableCell className="pr-6">
                {c.passed === true ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                    <Check className="size-4" /> Pass
                  </span>
                ) : c.passed === false ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700">
                    <X className="size-4" /> Fail
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Minus className="size-4" /> Not marked
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

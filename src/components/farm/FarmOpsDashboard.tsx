'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  ArrowUpRight,
  Bug,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  HardHat,
  Leaf,
  ListChecks,
  Package,
  Sprout,
  Tractor,
  Warehouse,
  Wheat,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDate, fmtHa, fmtMoney, fmtNumber, fmtPct, fmtQty } from '@/lib/farm/format';
import type { FarmOperations, FarmOverview } from '@/lib/farm/types';

export function OpsCard({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MiniBars({ values, tone = 'brand' }: { values: number[]; tone?: 'brand' | 'accent' | 'sky' }) {
  const max = Math.max(...values, 1);
  const fill =
    tone === 'accent' ? 'bg-accent-500' : tone === 'sky' ? 'bg-sky-500' : 'bg-brand-600';
  return (
    <div className="mt-3 flex h-8 items-end gap-0.5">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn('flex-1 rounded-sm opacity-80', fill)}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** Top-left: three headline KPIs with sparklines — farm equivalent of “Queue health”. */
export function FarmHealthCard({
  overview,
  currency,
}: {
  overview: FarmOverview;
  currency: string;
}) {
  const t = overview.totals;
  const harvest = overview.operations.harvest;
  const activities = overview.operations.activities;
  const plantedPct = t.totalAreaHa > 0 ? (t.plantedAreaHa / t.totalAreaHa) * 100 : null;
  const fieldCost = (activities?.totalCost ?? 0) + (harvest?.labourCost ?? 0);
  const costPerUnit =
    harvest && harvest.total > 0 ? fieldCost / harvest.total : null;
  const series = harvest?.series.map((d) => d.quantity) ?? Array.from({ length: 14 }, () => 0);
  const half = Math.ceil(series.length / 2);
  const sparkA = series.slice(0, half);
  const sparkB = series.slice(half);
  const sparkC = series.map((_, i) => (i % 3 === 0 ? fieldCost / Math.max(series.length, 1) : 0));

  return (
    <OpsCard title="Farm health">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">Planted area</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{fmtHa(t.plantedAreaHa)}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {plantedPct != null ? `${fmtNumber(plantedPct, 0)}% of ${fmtHa(t.totalAreaHa)}` : `${t.blocks} blocks`}
          </p>
          <MiniBars values={sparkA.length ? sparkA : [1, 2, 1, 3, 2]} tone="brand" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Exportable</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {harvest?.exportablePct != null ? fmtPct(harvest.exportablePct, 1) : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Rejected {harvest?.rejectionPct != null ? fmtPct(harvest.rejectionPct, 1) : '—'}
          </p>
          <MiniBars values={sparkB.length ? sparkB : [2, 1, 3, 2, 4]} tone="accent" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Cost / unit</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {costPerUnit != null ? fmtMoney(costPerUnit, currency) : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {harvest ? `per ${harvest.unit} · 30 days` : 'Field + harvest labour'}
          </p>
          <MiniBars values={sparkC.some((n) => n > 0) ? sparkC : [1, 1, 2, 1, 2]} tone="sky" />
        </div>
      </div>
    </OpsCard>
  );
}

/** Top-right: segmented status mix — blocks / crop / packhouse queues. */
export function FarmMixCard({ overview }: { overview: FarmOverview }) {
  const blocks = overview.blockMap;
  const byStatus = new Map<string, number>();
  for (const b of blocks) {
    const key = b.cycleStatus && ['active', 'harvesting', 'planned'].includes(b.cycleStatus) ? b.cycleStatus : b.status;
    byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
  }
  const total = Math.max(blocks.length, 1);
  const segments = [
    { key: 'active', label: 'Active', color: 'bg-brand-600', count: byStatus.get('active') ?? 0 },
    { key: 'harvesting', label: 'Harvesting', color: 'bg-accent-500', count: byStatus.get('harvesting') ?? 0 },
    { key: 'preparation', label: 'Preparation', color: 'bg-amber-400', count: byStatus.get('preparation') ?? 0 },
    { key: 'fallow', label: 'Fallow', color: 'bg-orange-300', count: byStatus.get('fallow') ?? 0 },
    { key: 'inactive', label: 'Inactive', color: 'bg-slate-300', count: byStatus.get('inactive') ?? 0 },
  ].filter((s) => s.count > 0);

  const display = segments.length
    ? segments
    : [{ key: 'empty', label: 'No blocks', color: 'bg-slate-200', count: 1 }];

  return (
    <OpsCard title="Block mix">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {display.map((s) => (
          <div
            key={s.key}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', s.color)}
            style={{ width: `${Math.max(4, (s.count / total) * 100)}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {(segments.length ? segments : display).map((s) => (
          <div key={s.key} className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={cn('size-2 shrink-0 rounded-full', s.color)} />
              {s.label}
            </div>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{s.count}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {overview.totals.openCycles} open planting{overview.totals.openCycles === 1 ? '' : 's'} ·{' '}
        {overview.totals.activeCrops} crop{overview.totals.activeCrops === 1 ? '' : 's'}
      </p>
    </OpsCard>
  );
}

/** Large harvest volume area chart. */
export function HarvestVolumeCard({ harvest }: { harvest: NonNullable<FarmOperations['harvest']> }) {
  const series = harvest.series;
  const max = Math.max(...series.map((d) => d.quantity), 0);
  const w = 640;
  const h = 180;
  const pad = 8;
  const points = series.map((d, i) => {
    const x = pad + (i / Math.max(series.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (max > 0 ? (d.quantity / max) * (h - pad * 2) : 0);
    return { x, y, ...d };
  });
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${points[points.length - 1]?.x ?? pad} ${h - pad} L ${pad} ${h - pad} Z`;
  const ticks = [0, Math.floor(series.length / 3), Math.floor((2 * series.length) / 3), series.length - 1];

  return (
    <OpsCard
      title="Harvest volume"
      action={
        <Link href="/harvest/batches" className="text-xs font-medium text-brand-600 hover:text-brand-700">
          All batches
        </Link>
      }
      className="min-h-[280px]"
    >
      <p className="text-sm text-slate-500">
        <span className="font-semibold text-slate-900">{fmtQty(harvest.total, harvest.unit)}</span>
        {' · '}
        {harvest.batches} batch{harvest.batches === 1 ? '' : 'es'}
        {' · '}
        {harvest.pendingGrading} awaiting grading
      </p>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="harvest-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2e5e4a" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2e5e4a" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {max > 0 ? (
            <>
              <path d={area} fill="url(#harvest-fill)" />
              <path d={line} fill="none" stroke="#2e5e4a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : (
            <text x={w / 2} y={h / 2} textAnchor="middle" className="fill-slate-400 text-sm">
              No harvests in this period
            </text>
          )}
        </svg>
        <div className="mt-1 flex justify-between text-[11px] text-slate-400">
          {ticks.map((i) => (
            <span key={i}>{series[i] ? format(parseISO(series[i].date), 'd MMM') : ''}</span>
          ))}
        </div>
      </div>
    </OpsCard>
  );
}

type AttentionRow = {
  key: string;
  label: string;
  count: number;
  href: string;
  tone: 'red' | 'amber' | 'slate' | 'brand';
  icon: ReactNode;
};

export function needsAttentionRows(o: FarmOverview): AttentionRow[] {
  const ops = o.operations;
  const rows: AttentionRow[] = [
    {
      key: 'severe',
      label: 'Serious pest / disease',
      count: ops.incidents?.severe ?? 0,
      href: '/farm/incidents',
      tone: 'red',
      icon: <Bug className="size-4" />,
    },
    {
      key: 'grading',
      label: 'Awaiting grading',
      count: ops.harvest?.pendingGrading ?? 0,
      href: '/harvest/grading',
      tone: 'amber',
      icon: <ClipboardCheck className="size-4" />,
    },
    {
      key: 'qc',
      label: 'QC awaiting review',
      count: ops.packhouse?.awaitingReview ?? 0,
      href: '/quality/inspections?review_status=awaiting_review',
      tone: 'amber',
      icon: <ClipboardCheck className="size-4" />,
    },
    {
      key: 'release',
      label: 'Ready for export release',
      count: ops.packhouse?.awaitingRelease ?? 0,
      href: '/packhouse/packing?qc_status=approved',
      tone: 'brand',
      icon: <Package className="size-4" />,
    },
    {
      key: 'stock',
      label: 'Not received into stock',
      count: ops.packhouse?.awaitingReceipt ?? 0,
      href: '/warehouse/inventory',
      tone: 'amber',
      icon: <Warehouse className="size-4" />,
    },
    {
      key: 'tasks',
      label: 'Overdue tasks',
      count: ops.tasks?.overdue ?? 0,
      href: '/workforce/tasks',
      tone: 'amber',
      icon: <ListChecks className="size-4" />,
    },
    {
      key: 'attendance',
      label: 'Attendance missing',
      count:
        ops.workforce && ops.workforce.activeWorkers > ops.workforce.markedToday
          ? ops.workforce.activeWorkers - ops.workforce.markedToday
          : 0,
      href: '/workforce/attendance',
      tone: 'slate',
      icon: <HardHat className="size-4" />,
    },
    {
      key: 'harvests',
      label: 'Harvests due (30 days)',
      count: o.totals.harvestDueNext30Days,
      href: '/farm/blocks',
      tone: 'brand',
      icon: <Wheat className="size-4" />,
    },
  ];
  return rows;
}

const ROW_TONE = {
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-800',
  slate: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-50 text-brand-800',
};

export function NeedsAttentionCard({ overview }: { overview: FarmOverview }) {
  const rows = needsAttentionRows(overview);
  const hot = rows.filter((r) => r.count > 0);

  return (
    <OpsCard title="Needs attention">
      {hot.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-brand-50 px-3 py-3 text-sm text-brand-800">
          <CheckCircle2 className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">All clear</p>
            <p className="text-xs text-brand-700/80">Nothing needs attention right now.</p>
          </div>
        </div>
      ) : null}
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.key}>
            <Link
              href={r.href}
              className={cn(
                'flex items-center gap-3 py-2.5 transition hover:bg-slate-50',
                r.count > 0 ? '' : 'opacity-55'
              )}
            >
              <span className={cn('flex size-8 items-center justify-center rounded-lg', ROW_TONE[r.tone])}>
                {r.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.label}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                  r.count > 0 ? ROW_TONE[r.tone] : 'bg-slate-100 text-slate-500'
                )}
              >
                {r.count}
              </span>
              <ArrowUpRight className="size-3.5 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>
    </OpsCard>
  );
}

export function ActivityByDayCard({ ops }: { ops: FarmOperations }) {
  const count = ops.activities?.count ?? 0;
  const labour = ops.activities?.labourCost ?? 0;
  const inputs = ops.activities?.inputCost ?? 0;
  const recent = ops.recent.filter((r) => r.kind === 'activity').slice(0, 4);

  return (
    <OpsCard
      title="Activity by day"
      action={
        <Link href="/farm/activities" className="text-xs font-medium text-brand-600 hover:text-brand-700">
          View
        </Link>
      }
    >
      <div className="flex items-baseline gap-3">
        <p className="text-3xl font-semibold tracking-tight text-slate-900">{count}</p>
        <p className="text-xs text-slate-500">field activities · 30 days</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-slate-500">Labour</p>
          <p className="font-semibold text-slate-900">{fmtNumber(labour, 0)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-slate-500">Inputs</p>
          <p className="font-semibold text-slate-900">{fmtNumber(inputs, 0)}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {recent.length ? (
          recent.map((r) => (
            <li key={r.id}>
              <Link href={r.href} className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-700">
                <Tractor className="size-3.5 shrink-0 text-brand-600" />
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="text-[11px] text-slate-400">{fmtDate(r.date)}</span>
              </Link>
            </li>
          ))
        ) : (
          <p className="text-sm text-slate-500">No activities recorded yet.</p>
        )}
      </ul>
    </OpsCard>
  );
}

export function WorkforceLoadCard({ ops }: { ops: FarmOperations }) {
  const w = ops.workforce;
  const tasks = ops.tasks;
  return (
    <OpsCard
      title="Workforce load"
      action={
        <Link href="/workforce/attendance" className="text-xs font-medium text-brand-600 hover:text-brand-700">
          Register
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500">Present today</p>
          <p className="text-2xl font-semibold text-slate-900">
            {w ? `${w.presentToday}` : '—'}
            {w ? <span className="text-base font-medium text-slate-400"> / {w.activeWorkers}</span> : null}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Open tasks</p>
          <p className="text-2xl font-semibold text-slate-900">{tasks?.open ?? '—'}</p>
          {tasks?.overdue ? (
            <p className="text-[11px] font-medium text-amber-700">{tasks.overdue} overdue</p>
          ) : (
            <p className="text-[11px] text-slate-400">On track</p>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Link
          href="/workforce/workers"
          className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
        >
          <HardHat className="size-4 text-brand-600" />
          Workers directory
          <ArrowUpRight className="ml-auto size-3.5 text-slate-300" />
        </Link>
        <Link
          href="/workforce/tasks"
          className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
        >
          <ListChecks className="size-4 text-brand-600" />
          Task board
          <ArrowUpRight className="ml-auto size-3.5 text-slate-300" />
        </Link>
      </div>
    </OpsCard>
  );
}

export function QualityTimesCard({ overview }: { overview: FarmOverview }) {
  const harvest = overview.operations.harvest;
  const ph = overview.operations.packhouse;
  const upcoming = overview.upcomingHarvests.slice(0, 3);

  return (
    <OpsCard
      title="Quality & harvest timing"
      action={
        <Link href="/farm/executive" className="text-xs font-medium text-brand-600 hover:text-brand-700">
          Executive
        </Link>
      }
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-brand-50 px-2 py-3">
          <p className="text-[11px] text-brand-700">Exportable</p>
          <p className="text-lg font-semibold text-brand-900">
            {harvest?.exportablePct != null ? fmtPct(harvest.exportablePct, 0) : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-red-50 px-2 py-3">
          <p className="text-[11px] text-red-700">Rejected</p>
          <p className="text-lg font-semibold text-red-800">
            {harvest?.rejectionPct != null ? fmtPct(harvest.rejectionPct, 0) : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-3">
          <p className="text-[11px] text-slate-500">Packhouse</p>
          <p className="text-lg font-semibold text-slate-900">
            {(ph?.awaitingReview ?? 0) + (ph?.awaitingRelease ?? 0) + (ph?.awaitingReceipt ?? 0)}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <CalendarClock className="size-3.5" /> Upcoming harvests
        </p>
        {upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.map((h) => (
              <li key={h.cycleId}>
                <Link href={`/farm/blocks/${h.blockId}`} className="flex items-start gap-2 text-sm hover:text-brand-700">
                  <Sprout className="mt-0.5 size-3.5 shrink-0 text-brand-600" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-slate-800">{h.crop}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {fmtDate(h.expectedHarvestDate)} · {h.block}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">None scheduled in the next 30 days.</p>
        )}
      </div>
    </OpsCard>
  );
}

export function CropStrip({ crops, totalAreaHa }: { crops: FarmOverview['cropBreakdown']; totalAreaHa: number }) {
  if (!crops.length) return null;
  return (
    <OpsCard title="Crop distribution">
      <div className="flex flex-wrap gap-2">
        {crops.map((c) => {
          const pct = totalAreaHa > 0 ? (c.areaHa / totalAreaHa) * 100 : 0;
          return (
            <div
              key={c.crop}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
            >
              <Leaf className="size-3.5 text-brand-600" />
              <span className="font-medium text-slate-800">{c.crop}</span>
              <span className="text-slate-500">
                {fmtHa(c.areaHa)} · {fmtPct(pct, 0)}
              </span>
            </div>
          );
        })}
      </div>
    </OpsCard>
  );
}

export function EmptyFarmSetup({ canAdd }: { canAdd: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <AlertTriangle className="size-5" />
        </span>
        <div>
          <p className="font-semibold text-slate-900">Set up your farm</p>
          <p className="text-sm text-slate-600">Add blocks, plant crops, then harvest and grade for the live dashboard.</p>
        </div>
      </div>
      {canAdd ? (
        <Link
          href="/farm/blocks?new=1"
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Add first block
        </Link>
      ) : null}
    </div>
  );
}

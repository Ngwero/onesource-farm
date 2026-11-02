'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  ArrowUpRight,
  Bug,
  CalendarDays,
  ChevronRight,
  Clock,
  ClipboardCheck,
  HardHat,
  ListChecks,
  MapPin,
  Plus,
  Sprout,
  Tractor,
  Wheat,
  CheckCircle2,
  CalendarClock,
  Package,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDate, fmtHa, fmtNumber, fmtPct, fmtQty } from '@/lib/farm/format';
import type { FarmOperations, FarmOverview } from '@/lib/farm/types';

// ——— Primitives ———

export function Glass({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-3xl border border-white/10 bg-[#0d241b]/55 p-5 text-white shadow-[0_10px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl',
        className
      )}
    >
      {children}
    </section>
  );
}

export function GlassTitle({ icon, title, subtitle, action }: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-lime-300">{icon}</span>
        <div>
          <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
          {subtitle ? <p className="text-xs text-white/55">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function GlassLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 text-xs font-medium text-lime-300 hover:text-lime-200">
      {children} <ChevronRight className="size-3.5" />
    </Link>
  );
}

// ——— Live clock (client only, avoids hydration mismatch) ———

function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 15_000);
  return () => clearInterval(id);
}
const clockSnapshot = () => format(new Date(), 'HH:mm');
const dateSnapshot = () => format(new Date(), 'EEEE d MMMM yyyy');
const serverSnapshot = () => '';

export function useClock() {
  const time = useSyncExternalStore(subscribeClock, clockSnapshot, serverSnapshot);
  const date = useSyncExternalStore(subscribeClock, dateSnapshot, serverSnapshot);
  return { time, date };
}

function greeting(time: string): string {
  if (!time) return 'Welcome';
  const h = Number(time.slice(0, 2));
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ——— Header ———

export function DashboardHeader({
  overview,
  firstName,
  actions,
}: {
  overview: FarmOverview | undefined;
  firstName: string;
  actions: ReactNode;
}) {
  const { time, date } = useClock();
  const farm = overview?.farm;
  const place = farm ? [farm.location, farm.district, farm.country].filter(Boolean).join(', ') : '';
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="text-sm text-lime-200/90">
          {greeting(time)}
          {firstName ? `, ${firstName}` : ''}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{farm?.name ?? 'Farm overview'}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/75">
          {place ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 backdrop-blur">
              <MapPin className="size-3.5" /> {place}
            </span>
          ) : null}
          {date ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 backdrop-blur">
              <CalendarDays className="size-3.5" /> {date}
            </span>
          ) : null}
          {time ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 backdrop-blur">
              <Clock className="size-3.5" /> {time}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function PillAction({ href, icon, children, primary }: { href: string; icon: ReactNode; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium backdrop-blur transition',
        primary
          ? 'bg-lime-300 text-[#0d241b] shadow-[0_0_24px_rgba(190,242,100,0.35)] hover:bg-lime-200'
          : 'border border-white/15 bg-white/10 text-white hover:bg-white/20'
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

// ——— Gauge ———

const ARC = 270;

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const sx = cx + r * Math.cos(rad(startDeg));
  const sy = cy + r * Math.sin(rad(startDeg));
  const ex = cx + r * Math.cos(rad(endDeg));
  const ey = cy + r * Math.sin(rad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}

export function Gauge({ value, label, caption }: { value: number | null; label: string; caption: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const start = -ARC / 2;
  const end = start + (ARC * pct) / 100;
  return (
    <div className="relative mx-auto w-48">
      <svg viewBox="0 0 200 180" className="w-full">
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="45%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#a3e635" />
          </linearGradient>
        </defs>
        <path d={arcPath(100, 100, 78, start, start + ARC)} stroke="rgba(255,255,255,0.12)" strokeWidth="12" fill="none" strokeLinecap="round" />
        {value != null && pct > 0 ? (
          <path d={arcPath(100, 100, 78, start, end)} stroke="url(#gauge-grad)" strokeWidth="12" fill="none" strokeLinecap="round" />
        ) : null}
      </svg>
      <div className="absolute inset-x-0 top-[34%] text-center">
        <p className="text-4xl font-semibold tracking-tight">{value == null ? '—' : `${fmtNumber(pct, 0)}%`}</p>
        <p className="mt-1 text-sm font-medium text-white/85">{label}</p>
      </div>
      <p className="-mt-3 text-center text-xs text-white/55">{caption}</p>
    </div>
  );
}

export function qualityLabel(pct: number | null): string {
  if (pct == null) return 'No grading yet';
  if (pct >= 85) return 'Excellent';
  if (pct >= 70) return 'Good';
  if (pct >= 50) return 'Fair';
  return 'Poor';
}

// ——— Harvest chart ———

export function HarvestChart({ harvest }: { harvest: NonNullable<FarmOperations['harvest']> }) {
  const max = Math.max(...harvest.series.map((d) => d.quantity), 0);
  const days = harvest.series.length;
  const avg = harvest.total / days;
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="text-xs text-white/55">Harvested, last {days} days</p>
          <p className="text-3xl font-semibold tracking-tight">{fmtQty(harvest.total, harvest.unit)}</p>
        </div>
        <div>
          <p className="text-xs text-white/55">Batches</p>
          <p className="text-lg font-semibold">{harvest.batches}</p>
        </div>
        <div>
          <p className="text-xs text-white/55">Daily average</p>
          <p className="text-lg font-semibold">{fmtQty(avg, harvest.unit)}</p>
        </div>
        {harvest.otherUnits.length ? (
          <p className="text-xs text-white/55">
            Also {harvest.otherUnits.map((u) => fmtQty(u.quantity, u.unit)).join(', ')}
          </p>
        ) : null}
      </div>
      <div className="relative mt-5 h-36">
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {harvest.series.map((d) => {
            const h = max > 0 ? Math.max(d.quantity > 0 ? 6 : 2, (d.quantity / max) * 100) : 2;
            return (
              <div
                key={d.date}
                className="group relative flex-1"
                style={{ height: `${h}%` }}
                title={`${fmtDate(d.date)}: ${fmtQty(d.quantity, harvest.unit)}`}
              >
                <div
                  className={cn(
                    'h-full w-full rounded-t-md transition',
                    d.quantity > 0 ? 'bg-gradient-to-t from-lime-500/50 to-lime-300 group-hover:to-lime-200' : 'bg-white/10'
                  )}
                />
              </div>
            );
          })}
        </div>
        {max === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">No harvests recorded in this period</div>
        ) : null}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-white/45">
        {[0, Math.floor(days / 3), Math.floor((2 * days) / 3), days - 1].map((i) => (
          <span key={i}>{format(parseISO(harvest.series[i].date), 'd MMM')}</span>
        ))}
      </div>
    </div>
  );
}

// ——— Rows ———

export function StatRow({ icon, label, value, hint, href }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; href?: string }) {
  const body = (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.04] px-3 py-2.5 transition hover:bg-white/[0.09]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lime-300">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-white/55">{label}</p>
        <p className="truncate text-[15px] font-semibold">{value}</p>
      </div>
      {hint ? <span className="text-right text-[11px] text-white/50">{hint}</span> : null}
      {href ? <ArrowUpRight className="size-4 text-white/40" /> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export type AttentionItem = { tone: 'red' | 'amber' | 'lime'; icon: ReactNode; title: string; detail: string; href: string };

export function attentionItems(o: FarmOverview): AttentionItem[] {
  const ops = o.operations;
  const items: AttentionItem[] = [];
  if (ops.incidents?.severe) {
    items.push({
      tone: 'red',
      icon: <Bug className="size-4" />,
      title: `${ops.incidents.severe} serious pest or disease case${ops.incidents.severe === 1 ? '' : 's'}`,
      detail: 'High or critical severity, not yet resolved',
      href: '/farm/incidents',
    });
  }
  if (ops.harvest?.pendingGrading) {
    items.push({
      tone: 'amber',
      icon: <ClipboardCheck className="size-4" />,
      title: `${ops.harvest.pendingGrading} batch${ops.harvest.pendingGrading === 1 ? '' : 'es'} awaiting grading`,
      detail: 'Grade them to know exportable quantities',
      href: '/harvest/grading',
    });
  }
  const ph = ops.packhouse;
  if (ph?.awaitingReview) {
    items.push({
      tone: 'amber',
      icon: <ClipboardCheck className="size-4" />,
      title: `${ph.awaitingReview} QC inspection${ph.awaitingReview === 1 ? '' : 's'} awaiting review`,
      detail: 'Supervisor approval needed',
      href: '/quality/inspections?review_status=awaiting_review',
    });
  }
  if (ph?.awaitingRelease) {
    items.push({
      tone: 'lime',
      icon: <Package className="size-4" />,
      title: `${ph.awaitingRelease} packed batch${ph.awaitingRelease === 1 ? '' : 'es'} ready for export release`,
      detail: 'QC approved, not yet released',
      href: '/packhouse/packing?qc_status=approved',
    });
  }
  if (ph?.awaitingReceipt) {
    items.push({
      tone: 'amber',
      icon: <Warehouse className="size-4" />,
      title: `${ph.awaitingReceipt} packed batch${ph.awaitingReceipt === 1 ? '' : 'es'} not received into stock`,
      detail: 'Book them into a warehouse location',
      href: '/warehouse/inventory',
    });
  }
  if (ops.incidents?.followUpDue) {
    items.push({
      tone: 'amber',
      icon: <CalendarClock className="size-4" />,
      title: `${ops.incidents.followUpDue} pest follow-up${ops.incidents.followUpDue === 1 ? '' : 's'} due`,
      detail: 'Check treated blocks',
      href: '/farm/incidents',
    });
  }
  if (ops.tasks?.overdue) {
    items.push({
      tone: 'amber',
      icon: <ListChecks className="size-4" />,
      title: `${ops.tasks.overdue} overdue task${ops.tasks.overdue === 1 ? '' : 's'}`,
      detail: 'Past due and not completed',
      href: '/workforce/tasks',
    });
  }
  const w = ops.workforce;
  if (w && w.activeWorkers > 0 && w.markedToday < w.activeWorkers) {
    const missing = w.activeWorkers - w.markedToday;
    items.push({
      tone: 'lime',
      icon: <HardHat className="size-4" />,
      title: `Attendance not taken for ${missing} worker${missing === 1 ? '' : 's'}`,
      detail: "Today's register",
      href: '/workforce/attendance',
    });
  }
  if (o.totals.harvestDueNext30Days) {
    items.push({
      tone: 'lime',
      icon: <Wheat className="size-4" />,
      title: `${o.totals.harvestDueNext30Days} planting${o.totals.harvestDueNext30Days === 1 ? '' : 's'} due for harvest`,
      detail: 'Expected within 30 days',
      href: '/farm/blocks',
    });
  }
  return items;
}

const TONE = {
  red: 'bg-red-500/20 text-red-300',
  amber: 'bg-amber-400/20 text-amber-200',
  lime: 'bg-lime-300/15 text-lime-300',
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (!items.length) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3 text-sm">
        <span className="flex size-9 items-center justify-center rounded-xl bg-lime-300/15 text-lime-300">
          <CheckCircle2 className="size-4" />
        </span>
        <div>
          <p className="font-semibold">All clear</p>
          <p className="text-xs text-white/55">Nothing needs attention right now.</p>
        </div>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.title}>
          <Link
            href={i.href}
            className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.04] px-3 py-2.5 transition hover:bg-white/[0.09]"
          >
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', TONE[i.tone])}>{i.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">{i.title}</p>
              <p className="truncate text-xs text-white/55">{i.detail}</p>
            </div>
            <ChevronRight className="size-4 text-white/40" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ——— Blocks ———

const BLOCK_DOT: Record<string, string> = {
  active: 'bg-lime-300',
  harvesting: 'bg-yellow-300',
  planned: 'bg-sky-300',
  preparation: 'bg-amber-300',
  fallow: 'bg-orange-300',
  inactive: 'bg-white/40',
};

export function BlockTiles({ blocks, canAdd }: { blocks: FarmOverview['blockMap']; canAdd: boolean }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {blocks.map((b) => {
        const expected = Number(b.expectedYield ?? 0);
        const pct = expected > 0 ? Math.min(100, (b.actualYield / expected) * 100) : 0;
        const state = b.cycleStatus && ['active', 'harvesting', 'planned'].includes(b.cycleStatus) ? b.cycleStatus : b.status;
        return (
          <Link
            key={b.id}
            href={`/farm/blocks/${b.id}`}
            className="group w-44 shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 transition hover:-translate-y-0.5 hover:border-lime-300/40 hover:bg-white/[0.1]"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold tracking-tight">{b.code}</span>
              <span className="flex items-center gap-1.5 text-[11px] capitalize text-white/60">
                <span className={cn('size-2 rounded-full', BLOCK_DOT[state] ?? 'bg-white/40')} />
                {state}
              </span>
            </div>
            <p className="truncate text-xs text-white/55">
              {b.name} · {fmtHa(b.areaHa)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Sprout className="size-4 text-lime-300" />
              <span className="truncate text-sm font-medium">{b.crop ?? 'Not planted'}</span>
            </div>
            {b.variety ? <p className="truncate pl-6 text-[11px] text-white/50">{b.variety}</p> : null}
            {b.crop ? (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-lime-400 to-lime-200" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-white/50">
                  {expected > 0 ? `${fmtNumber(pct, 0)}% of ${fmtQty(expected, b.unit)}` : `${fmtQty(b.actualYield, b.unit)} harvested`}
                </p>
              </div>
            ) : null}
          </Link>
        );
      })}
      {canAdd ? (
        <Link
          href="/farm/blocks?new=1"
          className="flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-sm text-white/70 transition hover:border-lime-300/50 hover:text-lime-200"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
            <Plus className="size-4" />
          </span>
          Add block
        </Link>
      ) : null}
    </div>
  );
}

// ——— Crop mix ———

const CROP_BARS = ['from-lime-300 to-lime-500', 'from-yellow-200 to-yellow-400', 'from-emerald-300 to-emerald-500', 'from-sky-300 to-sky-500', 'from-orange-200 to-orange-400'];

export function CropMix({ crops, totalAreaHa }: { crops: FarmOverview['cropBreakdown']; totalAreaHa: number }) {
  if (!crops.length) return <p className="text-sm text-white/60">Nothing planted yet.</p>;
  return (
    <ul className="space-y-3">
      {crops.map((c, i) => {
        const pct = totalAreaHa > 0 ? (c.areaHa / totalAreaHa) * 100 : 0;
        return (
          <li key={c.crop}>
            <div className="flex justify-between text-xs">
              <span className="font-medium text-white/85">{c.crop}</span>
              <span className="text-white/55">
                {fmtHa(c.areaHa)} · {fmtPct(pct, 0)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className={cn('h-full rounded-full bg-gradient-to-r', CROP_BARS[i % CROP_BARS.length])} style={{ width: `${Math.max(3, pct)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-white/45">
              {c.blocks} block{c.blocks === 1 ? '' : 's'} · expecting {fmtQty(c.expectedYield, c.unit)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

// ——— Timeline & feed ———

export function UpcomingHarvests({ items }: { items: FarmOverview['upcomingHarvests'] }) {
  if (!items.length) return <p className="text-sm text-white/60">No harvests expected in the next 30 days.</p>;
  return (
    <ol className="relative space-y-3 border-l border-white/15 pl-4">
      {items.slice(0, 5).map((h) => (
        <li key={h.cycleId} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-lime-300 ring-4 ring-lime-300/15" />
          <Link href={`/farm/blocks/${h.blockId}`} className="block hover:text-lime-200">
            <p className="text-xs text-white/55">{fmtDate(h.expectedHarvestDate)}</p>
            <p className="text-sm font-medium">
              {h.crop}
              {h.variety ? <span className="text-white/55"> · {h.variety}</span> : null}
            </p>
            <p className="text-[11px] text-white/50">
              {h.block}
              {h.expectedYield ? ` · ${fmtQty(h.expectedYield, h.unit)}` : ''}
            </p>
          </Link>
        </li>
      ))}
    </ol>
  );
}

const FEED_ICON = {
  harvest: <Wheat className="size-4" />,
  activity: <Tractor className="size-4" />,
  incident: <AlertTriangle className="size-4" />,
};

export function RecentFeed({ items }: { items: FarmOperations['recent'] }) {
  if (!items.length) return <p className="text-sm text-white/60">No field records in the last 30 days.</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((r) => (
        <li key={`${r.kind}-${r.id}`}>
          <Link href={r.href} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5 transition hover:bg-white/[0.09]">
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl',
                r.kind === 'incident' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-lime-300'
              )}
            >
              {FEED_ICON[r.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.title}</p>
              <p className="truncate text-xs text-white/55">{r.detail}</p>
            </div>
            <span className="shrink-0 text-[11px] text-white/45">{fmtDate(r.date)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
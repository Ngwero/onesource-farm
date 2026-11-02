'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bug,
  ClipboardCheck,
  Gauge as GaugeIcon,
  HardHat,
  LayoutGrid,
  Leaf,
  ListChecks,
  Pencil,
  Plus,
  Sprout,
  Tractor,
  Wallet,
  Wheat,
  Bell,
  CalendarClock,
} from 'lucide-react';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { ErrorState } from '@/components/farm/DataStates';
import {
  AttentionList,
  BlockTiles,
  CropMix,
  DashboardHeader,
  Gauge,
  Glass,
  GlassLink,
  GlassTitle,
  HarvestChart,
  PillAction,
  RecentFeed,
  StatRow,
  UpcomingHarvests,
  attentionItems,
  qualityLabel,
} from '@/components/farm/FarmDashboard';
import { FarmProfileSheet } from '@/components/farm/forms/FarmProfileSheet';
import { useAuth } from '@/context/AuthContext';
import { farmKeys, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtHa, fmtMoney, fmtNumber, fmtPct, fmtQty } from '@/lib/farm/format';
import type { FarmOverview } from '@/lib/farm/types';

function HeroStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-white/60">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-white drop-shadow sm:text-4xl">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-white/60">{hint}</p> : null}
    </div>
  );
}

function SkeletonPanels() {
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_340px]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-80 animate-pulse rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl" />
      ))}
    </div>
  );
}

function FarmDashboardPage() {
  const { can } = useFarmAccess();
  const { user } = useAuth();
  const currency = useCurrency();
  const [editing, setEditing] = useState(false);
  const overview = useQuery({
    queryKey: farmKeys.overview,
    queryFn: () => farmFetch<FarmOverview>('/api/farm/overview'),
  });

  if (overview.error) {
    return <ErrorState message={errorMessage(overview.error)} onRetry={() => overview.refetch()} />;
  }

  const data = overview.data;
  const t = data?.totals;
  const ops = data?.operations;
  const harvest = ops?.harvest;
  const plantedPct = t && t.totalAreaHa > 0 ? (t.plantedAreaHa / t.totalAreaHa) * 100 : null;
  const fieldCost = (ops?.activities?.totalCost ?? 0) + (harvest?.labourCost ?? 0);
  const firstName = user?.full_name?.split(' ')[0] ?? '';

  const actions = (
    <>
      {can('farm.manage') && data ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
        >
          <Pencil className="size-4" /> Edit farm
        </button>
      ) : null}
      {can('activities.record') ? (
        <PillAction href="/farm/activities?new=1" icon={<Tractor className="size-4" />}>
          Activity
        </PillAction>
      ) : null}
      {can('pest.record') ? (
        <PillAction href="/farm/incidents?new=1" icon={<Bug className="size-4" />}>
          Pest report
        </PillAction>
      ) : null}
      {can('attendance.record') ? (
        <PillAction href="/workforce/attendance" icon={<HardHat className="size-4" />}>
          Attendance
        </PillAction>
      ) : null}
      {can('harvest.record') ? (
        <PillAction href="/harvest/batches?new=1" icon={<Plus className="size-4" />} primary>
          Record harvest
        </PillAction>
      ) : null}
    </>
  );

  return (
    <div className="relative isolate -m-1 overflow-hidden rounded-[28px] bg-[#0b1f17]">
      <Image src="/farm-hero.jpg" alt="" fill priority sizes="100vw" className="-z-20 object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,26,19,0.78)_0%,rgba(8,26,19,0.45)_30%,rgba(8,26,19,0.72)_65%,rgba(8,26,19,0.95)_100%)]" />

      <div className="space-y-6 p-5 sm:p-7 xl:p-8">
        <DashboardHeader overview={data} firstName={firstName} actions={actions} />

        {!data || !t || !ops ? (
          <SkeletonPanels />
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_340px]">
              {/* Left column */}
              <div className="space-y-5">
                <Glass>
                  {harvest ? (
                    <>
                      <GlassTitle icon={<GaugeIcon className="size-4" />} title="Export quality" subtitle="Graded harvest, last 30 days" />
                      <Gauge value={harvest.exportablePct} label={qualityLabel(harvest.exportablePct)} caption="Share of graded produce fit for export" />
                      <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-300/15 px-2.5 py-1 text-lime-200">
                          <span className="size-1.5 rounded-full bg-lime-300" /> Exportable {fmtPct(harvest.exportablePct, 0)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-red-200">
                          <span className="size-1.5 rounded-full bg-red-400" /> Rejected {fmtPct(harvest.rejectionPct, 0)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <GlassTitle icon={<GaugeIcon className="size-4" />} title="Land in use" subtitle="Planted share of block area" />
                      <Gauge value={plantedPct} label={`${fmtHa(t.plantedAreaHa)} planted`} caption={`of ${fmtHa(t.totalAreaHa)} in blocks`} />
                    </>
                  )}
                </Glass>

                <Glass>
                  <GlassTitle icon={<Bell className="size-4" />} title="Needs attention" subtitle="What to act on today" />
                  <AttentionList items={attentionItems(data)} />
                </Glass>
              </div>

              {/* Centre column */}
              <div className="flex min-w-0 flex-col gap-5">
                <div className="grid grid-cols-2 gap-6 px-1 pt-2 sm:grid-cols-3">
                  <HeroStat
                    label="Planted area"
                    value={fmtHa(t.plantedAreaHa)}
                    hint={plantedPct != null ? `${fmtNumber(plantedPct, 0)}% of ${fmtHa(t.totalAreaHa)}` : 'No blocks yet'}
                  />
                  <HeroStat label="Active plantings" value={String(t.openCycles)} hint={`${t.activeCrops} crop${t.activeCrops === 1 ? '' : 's'} · ${t.blocks} blocks`} />
                  <HeroStat
                    label="Expected yield"
                    value={fmtNumber(t.expectedYieldOpen)}
                    hint={`${fmtNumber(t.actualYieldOpen)} harvested so far`}
                  />
                </div>

                {harvest ? (
                  <Glass>
                    <GlassTitle
                      icon={<Wheat className="size-4" />}
                      title="Harvest"
                      subtitle="Daily harvested quantity"
                      action={<GlassLink href="/harvest/batches">All batches</GlassLink>}
                    />
                    <HarvestChart harvest={harvest} />
                  </Glass>
                ) : null}

                <Glass className="flex-1">
                  <GlassTitle
                    icon={<LayoutGrid className="size-4" />}
                    title="Blocks"
                    subtitle={`${t.blocks} block${t.blocks === 1 ? '' : 's'} · ${fmtHa(t.totalAreaHa)}`}
                    action={<GlassLink href="/farm/blocks">Manage</GlassLink>}
                  />
                  {data.blockMap.length ? (
                    <BlockTiles blocks={data.blockMap} canAdd={can('farm.manage')} />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-white/20 p-5">
                      <div>
                        <p className="font-semibold">Set up your farm</p>
                        <p className="text-sm text-white/60">Add the blocks or plots on the farm, then record what is planted in each.</p>
                      </div>
                      {can('farm.manage') ? (
                        <PillAction href="/farm/blocks?new=1" icon={<Plus className="size-4" />} primary>
                          Add first block
                        </PillAction>
                      ) : null}
                    </div>
                  )}
                </Glass>
              </div>

              {/* Right column */}
              <div className="grid content-start gap-5 md:grid-cols-2 lg:col-span-2 xl:grid-cols-3 2xl:col-span-1 2xl:grid-cols-1">
                <Glass>
                  <GlassTitle icon={<Activity className="size-4" />} title="Today on the farm" subtitle="Live operations" />
                  <div className="space-y-2">
                    {ops.workforce ? (
                      <StatRow
                        icon={<HardHat className="size-4" />}
                        label="Workers present"
                        value={`${ops.workforce.presentToday} of ${ops.workforce.activeWorkers}`}
                        hint={ops.workforce.markedToday < ops.workforce.activeWorkers ? 'Register open' : 'Register done'}
                        href="/workforce/attendance"
                      />
                    ) : null}
                    {ops.tasks ? (
                      <StatRow
                        icon={<ListChecks className="size-4" />}
                        label="Open tasks"
                        value={ops.tasks.open}
                        hint={ops.tasks.overdue ? `${ops.tasks.overdue} overdue` : undefined}
                        href="/workforce/tasks"
                      />
                    ) : null}
                    {ops.incidents ? (
                      <StatRow
                        icon={<Bug className="size-4" />}
                        label="Pest & disease open"
                        value={ops.incidents.unresolved}
                        hint={ops.incidents.severe ? `${ops.incidents.severe} serious` : undefined}
                        href="/farm/incidents"
                      />
                    ) : null}
                    {harvest ? (
                      <StatRow
                        icon={<ClipboardCheck className="size-4" />}
                        label="Awaiting grading"
                        value={harvest.pendingGrading}
                        href="/harvest/grading"
                      />
                    ) : null}
                    <StatRow
                      icon={<CalendarClock className="size-4" />}
                      label="Harvests due (30 days)"
                      value={t.harvestDueNext30Days}
                    />
                    {ops.activities || harvest ? (
                      <StatRow
                        icon={<Wallet className="size-4" />}
                        label="Field cost (30 days)"
                        value={fmtMoney(fieldCost, currency)}
                        hint={ops.activities ? `${ops.activities.count} activities` : undefined}
                        href={ops.activities ? '/farm/activities' : undefined}
                      />
                    ) : null}
                  </div>
                </Glass>

                <Glass>
                  <GlassTitle icon={<Leaf className="size-4" />} title="Crop distribution" subtitle="Share of block area" />
                  <CropMix crops={data.cropBreakdown} totalAreaHa={t.totalAreaHa} />
                </Glass>

                <Glass>
                  <GlassTitle icon={<Sprout className="size-4" />} title="Upcoming harvests" subtitle="Next 30 days" />
                  <UpcomingHarvests items={data.upcomingHarvests} />
                </Glass>
              </div>
            </div>

            <Glass>
              <GlassTitle icon={<Activity className="size-4" />} title="Recent field records" subtitle="Harvests, activities and pest reports, last 30 days" />
              <RecentFeed items={ops.recent} />
              {harvest && harvest.total > 0 && ops.activities ? (
                <p className="mt-4 text-xs text-white/50">
                  Field cost per {harvest.unit} harvested this month: {fmtMoney(fieldCost / harvest.total, currency)} ({fmtQty(harvest.total, harvest.unit)} from{' '}
                  {fmtMoney(fieldCost, currency)}).
                </p>
              ) : null}
            </Glass>
          </>
        )}
      </div>

      {data ? <FarmProfileSheet open={editing} onOpenChange={setEditing} farm={data.farm} /> : null}
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="farm.view">
      <FarmDashboardPage />
    </RequirePermission>
  );
}

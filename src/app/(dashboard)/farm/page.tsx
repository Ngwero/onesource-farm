'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bug,
  HardHat,
  Pencil,
  Plus,
  Tractor,
} from 'lucide-react';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { ErrorState } from '@/components/farm/DataStates';
import {
  ActivityByDayCard,
  CropStrip,
  EmptyFarmSetup,
  FarmHealthCard,
  FarmMixCard,
  HarvestVolumeCard,
  NeedsAttentionCard,
  QualityTimesCard,
  WorkforceLoadCard,
} from '@/components/farm/FarmOpsDashboard';
import { FarmWeatherStrip } from '@/components/farm/FarmWeatherStrip';
import { FarmProfileSheet } from '@/components/farm/forms/FarmProfileSheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { farmKeys, useCurrency } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDate } from '@/lib/farm/format';
import type { FarmOverview } from '@/lib/farm/types';

function SkeletonPanels() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl bg-brand-100/60" />
        <div className="h-40 animate-pulse rounded-2xl bg-brand-100/60" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className="h-72 animate-pulse rounded-2xl bg-brand-100/60" />
        <div className="h-72 animate-pulse rounded-2xl bg-brand-100/60" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-brand-100/60" />
        ))}
      </div>
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
  const firstName = user?.full_name?.split(' ')[0] ?? '';
  const farm = data?.farm;
  const place = farm ? [farm.location, farm.district, farm.country].filter(Boolean).join(', ') : '';

  return (
    <div className="space-y-5">
      <FarmWeatherStrip />

      <header className="overflow-hidden rounded-2xl border border-brand-800/20 bg-[linear-gradient(135deg,#152c23_0%,#1e3e31_42%,#2e5e4a_78%,#377256_100%)] text-white shadow-[var(--shadow-card)]">
        <div className="relative px-5 py-6 sm:px-7 sm:py-7">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgb(180_207_94/0.28),transparent_42%)]"
            aria-hidden
          />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-400/90">
                {firstName ? `Welcome back, ${firstName}` : 'Farm operations'}
              </p>
              <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                {farm?.name ?? 'Farm overview'}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-white/70">
                {[place, fmtDate(new Date().toISOString().slice(0, 10))].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {can('farm.view') || can('profitability.view') ? (
                <Button asChild variant="secondary" className="border-white/15 bg-white/10 text-white hover:bg-white/18 hover:text-white">
                  <Link href="/farm/executive">
                    <BarChart3 className="size-4" />
                    Executive
                  </Link>
                </Button>
              ) : null}
              {can('farm.manage') && data ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="border-white/15 bg-white/10 text-white hover:bg-white/18 hover:text-white"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-4" /> Edit farm
                </Button>
              ) : null}
              {can('activities.record') ? (
                <Button asChild variant="secondary" className="border-white/15 bg-white/10 text-white hover:bg-white/18 hover:text-white">
                  <Link href="/farm/activities?new=1">
                    <Tractor className="size-4" /> Activity
                  </Link>
                </Button>
              ) : null}
              {can('pest.record') ? (
                <Button asChild variant="secondary" className="border-white/15 bg-white/10 text-white hover:bg-white/18 hover:text-white">
                  <Link href="/farm/incidents?new=1">
                    <Bug className="size-4" /> Pest
                  </Link>
                </Button>
              ) : null}
              {can('attendance.record') ? (
                <Button asChild variant="secondary" className="border-white/15 bg-white/10 text-white hover:bg-white/18 hover:text-white">
                  <Link href="/workforce/attendance">
                    <HardHat className="size-4" /> Attendance
                  </Link>
                </Button>
              ) : null}
              {can('harvest.record') ? (
                <Button asChild className="bg-accent-500 text-brand-950 shadow-none hover:bg-accent-400 hover:brightness-100">
                  <Link href="/harvest/batches?new=1">
                    <Plus className="size-4" /> Record harvest
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {!data ? (
        <SkeletonPanels />
      ) : (
        <>
          {!data.blockMap.length ? <EmptyFarmSetup canAdd={can('farm.manage')} /> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <FarmHealthCard overview={data} currency={currency} />
            <FarmMixCard overview={data} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
            {data.operations.harvest ? (
              <HarvestVolumeCard harvest={data.operations.harvest} />
            ) : (
              <section className="flex min-h-[280px] flex-col justify-center rounded-2xl border border-dashed border-brand-200 bg-white/80 p-6 text-center shadow-[var(--shadow-soft)]">
                <p className="font-display text-lg font-semibold text-foreground">Harvest volume</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Record harvest batches to see the 30-day volume chart here.
                </p>
                {can('harvest.record') ? (
                  <Button asChild className="mx-auto mt-4">
                    <Link href="/harvest/batches?new=1">
                      <Plus className="size-4" /> Record harvest
                    </Link>
                  </Button>
                ) : null}
              </section>
            )}
            <NeedsAttentionCard overview={data} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ActivityByDayCard ops={data.operations} />
            <WorkforceLoadCard ops={data.operations} />
            <QualityTimesCard overview={data} />
          </div>

          {data.cropBreakdown.length ? (
            <CropStrip crops={data.cropBreakdown} totalAreaHa={data.totals.totalAreaHa} />
          ) : null}
        </>
      )}

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

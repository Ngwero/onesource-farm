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
import { FarmProfileSheet } from '@/components/farm/forms/FarmProfileSheet';
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
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-200/70" />
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {firstName ? `Welcome back, ${firstName}` : 'Farm operations'}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {farm?.name ?? 'Farm overview'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {[place, fmtDate(new Date().toISOString().slice(0, 10))].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('farm.view') || can('profitability.view') ? (
            <Link
              href="/farm/executive"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <BarChart3 className="size-4 text-brand-600" />
              Executive
            </Link>
          ) : null}
          {can('farm.manage') && data ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="size-4" /> Edit farm
            </button>
          ) : null}
          {can('activities.record') ? (
            <Link
              href="/farm/activities?new=1"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Tractor className="size-4" /> Activity
            </Link>
          ) : null}
          {can('pest.record') ? (
            <Link
              href="/farm/incidents?new=1"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Bug className="size-4" /> Pest
            </Link>
          ) : null}
          {can('attendance.record') ? (
            <Link
              href="/workforce/attendance"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <HardHat className="size-4" /> Attendance
            </Link>
          ) : null}
          {can('harvest.record') ? (
            <Link
              href="/harvest/batches?new=1"
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="size-4" /> Record harvest
            </Link>
          ) : null}
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
              <section className="flex min-h-[280px] flex-col justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
                <p className="font-semibold text-slate-900">Harvest volume</p>
                <p className="mt-1 text-sm text-slate-500">Record harvest batches to see the 30-day volume chart here.</p>
                {can('harvest.record') ? (
                  <Link
                    href="/harvest/batches?new=1"
                    className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    <Plus className="size-4" /> Record harvest
                  </Link>
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

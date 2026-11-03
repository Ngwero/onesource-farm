'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Clock3, CloudOff, CloudSun, Droplets, MapPin, Navigation, RefreshCw, Wind } from 'lucide-react';
import { farmKeys } from '@/hooks/farm';
import { farmFetch } from '@/lib/farm/client';
import { cn } from '@/lib/utils';
import type { DailyForecast, WeatherForecast } from '@/lib/farm/weather';

type LocSource = 'device' | 'farm' | 'region';

function sprayTone(score: number, unavailable = false) {
  if (unavailable) return 'bg-white/10 text-white/65 border-white/20';
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30';
  if (score >= 55) return 'bg-amber-500/20 text-amber-100 border-amber-400/30';
  return 'bg-red-500/20 text-red-100 border-red-400/30';
}

function readDeviceLocation(): Promise<{ lat: number; lng: number; accuracy: number | null } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5 * 60_000 }
    );
  });
}

function sourceLabel(source: LocSource, regionLabel?: string | null) {
  if (source === 'device') return 'Using your location';
  if (source === 'farm') return 'Using farm GPS';
  return `Approximate · ${regionLabel || 'farm region'}`;
}

function DayCell({ day, active, onSelect }: { day: DailyForecast; active?: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${format(parseISO(day.date), 'EEEE d MMM')}: ${day.sprayLabel}`}
      className={cn(
        'min-w-[7.75rem] flex-1 rounded-xl border px-3 py-3 text-center transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300',
        active
          ? 'border-lime-300/50 bg-white/15 shadow-[0_0_0_1px_rgb(180_207_94/0.2)]'
          : 'border-white/10 bg-white/5'
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">
        {format(parseISO(day.date), 'EEE')}
      </p>
      <p className="mt-0.5 text-[11px] text-white/45">{format(parseISO(day.date), 'd MMM')}</p>
      <p className="mt-2 text-xs font-semibold text-white">{day.label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-white">
        {day.tempMaxC != null ? `${Math.round(day.tempMaxC)}°` : '—'}
        <span className="text-white/45">
          {' '}
          / {day.tempMinC != null ? `${Math.round(day.tempMinC)}°` : '—'}
        </span>
      </p>
      <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-sky-200/90">
        <Droplets className="size-3" />
        {day.precipMm != null ? `${day.precipMm.toFixed(1)} mm / day` : '—'}
      </p>
      <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-white/60">
        <Wind className="size-3" /> {day.windMaxKmh != null ? `up to ${Math.round(day.windMaxKmh)} km/h` : '—'}
      </p>
      <p
        className={cn(
          'mt-2 inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold',
          sprayTone(day.sprayScore, !day.assessedHours)
        )}
      >
        {day.sprayLabel}
      </p>
      <p className="mt-1.5 text-[11px] tabular-nums text-white/75">
        {day.sprayWindows[0] ? `${day.sprayWindows[0].start.slice(11, 16)}–${day.sprayWindows[0].end.slice(11, 16)}` : 'View details'}
      </p>
    </button>
  );
}

export function FarmWeatherStrip() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const weather = useQuery({
    queryKey: [...farmKeys.overview, 'weather-forecast-hourly-v2', 'auto'] as const,
    queryFn: async () => {
      const device = await readDeviceLocation();
      const qs = new URLSearchParams({ forecast: '1', days: '7' });
      if (device) {
        qs.set('lat', String(device.lat));
        qs.set('lng', String(device.lng));
      }
      const res = await farmFetch<{
        forecast: WeatherForecast;
        lat: number;
        lng: number;
        source?: LocSource;
        regionLabel?: string | null;
      }>(`/api/farm/weather?${qs}`);
      return {
        ...res,
        source: (device ? 'device' : res.source || 'region') as LocSource,
        accuracy: device?.accuracy ?? null,
      };
    },
    staleTime: 15 * 60_000,
    retry: 1,
  });

  if (weather.isLoading) {
    return (
      <section className="overflow-hidden rounded-2xl border border-brand-800/15 bg-brand-900/90 p-4 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-white/70">
          <Navigation className="size-4 animate-pulse text-lime-300" />
          Loading automatic forecast…
        </div>
        <div className="mt-3 h-24 animate-pulse rounded-xl bg-white/10" />
      </section>
    );
  }

  if (weather.error || !weather.data?.forecast) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-brand-300 bg-white/90 px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <CloudOff className="size-5" />
          </div>
          <div>
            <p className="font-display text-base font-semibold text-foreground">Weather forecast</p>
            <p className="text-sm text-muted-foreground">
              {weather.error instanceof Error ? weather.error.message : 'Forecast unavailable right now.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
          onClick={() => void weather.refetch()}
        >
          <Navigation className="size-4" /> Retry
        </button>
      </section>
    );
  }

  const { forecast, source, regionLabel, accuracy, lat, lng } = weather.data;
  const { current, days } = forecast;
  const selected = days.find((day) => day.date === selectedDate) ?? days[0];

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-800/20 bg-[linear-gradient(135deg,#0c1a14_0%,#1e3e31_45%,#264e3e_100%)] text-white shadow-lg">
      <div className="relative px-4 py-4 sm:px-5 sm:py-5">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgb(180_207_94/0.18),transparent_40%)]"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-lime-300">
              <CloudSun className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime-300/90">
                Weather forecast
              </p>
              <p className="font-display mt-1 text-2xl font-semibold tracking-tight">
                {current.tempC != null ? `${Math.round(current.tempC)}°C` : '—'}
                <span className="ml-2 text-base font-medium text-white/70">{current.summary.split(',')[0]}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/65">
                <span className="inline-flex items-center gap-1">
                  <Wind className="size-3.5" />
                  {current.windKmh != null ? `${Math.round(current.windKmh)} km/h` : '—'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Droplets className="size-3.5" />
                  {current.humidityPct != null ? `${Math.round(current.humidityPct)}% RH` : '—'}
                </span>
                <span
                  className={cn(
                    'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    sprayTone(current.sprayScore, current.sprayLabel === 'No forecast')
                  )}
                >
                  {current.sprayLabel === 'No forecast' ? 'Current data unavailable' : current.sprayScore >= 80 ? 'Favorable now' : current.sprayScore >= 55 ? 'Check conditions now' : 'Unsuitable now'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-white/50">
            <p className="inline-flex items-center gap-1">
              {source === 'device' ? (
                <Navigation className="size-3.5" />
              ) : (
                <MapPin className="size-3.5" />
              )}
              {sourceLabel(source, regionLabel)}
              {source === 'device' && accuracy != null ? ` · ±${Math.round(accuracy)} m` : ''}
            </p>
            <p className="mt-1">
              {days.length}-day outlook · Open-Meteo · {forecast.timezone}
            </p>
            <p className="mt-1">{lat.toFixed(2)}°, {lng.toFixed(2)}° · Updated {new Date(forecast.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <button type="button" onClick={() => void weather.refetch()} disabled={weather.isFetching}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/20 px-2 py-1 text-white/80 hover:bg-white/10 disabled:opacity-50">
              <RefreshCw className={cn('size-3', weather.isFetching && 'animate-spin')} /> Refresh
            </button>
          </div>
        </div>

        {days.length ? (
          <div className="relative mt-4 flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => (
              <DayCell key={day.date} day={day} active={day.date === selected?.date} onSelect={() => setSelectedDate(day.date)} />
            ))}
          </div>
        ) : null}
        {selected ? (
          <div className="relative mt-3 rounded-xl border border-white/15 bg-black/15 p-4" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4 text-lime-300" />
                Spray planning · {format(parseISO(selected.date), 'EEEE d MMM')}
              </h3>
              <span className={cn('rounded-full border px-2 py-0.5 text-xs', sprayTone(selected.sprayScore, !selected.assessedHours))}>{selected.sprayLabel}</span>
            </div>
            {selected.sprayWindows.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.sprayWindows.map((window) => (
                  <div key={window.start} className={cn('rounded-lg border px-3 py-2', sprayTone(window.score))}>
                    <p className="text-sm font-semibold tabular-nums">{window.start.slice(11, 16)}–{window.end.slice(11, 16)}</p>
                    <p className="mt-0.5 text-[11px]">{window.label} · {window.score}/100</p>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="mt-3 text-xs text-white/75">{selected.sprayReasons.join(' · ')}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/50">
              Estimates use hourly daylight weather, at least 2 continuous hours and a 2-hour dry outlook.
              All window times are {forecast.timezone}. Check field conditions and the product’s label before application.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { HttpError } from '@/lib/farm/http';
import {
  coordsForCountry,
  fetchWeatherForecast,
  fetchWeatherSnapshot,
} from '@/lib/farm/weather';

type CoordSource = 'device' | 'farm' | 'region';

async function resolveFarmCoords(
  lat: number,
  lng: number,
  blockId: string | null
): Promise<{ lat: number; lng: number; source: CoordSource; regionLabel?: string }> {
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, source: 'device' };
  }

  const supabase = createServiceClient();
  const farmId = await getCurrentFarmId();

  if (blockId) {
    const { data, error } = await supabase
      .from('blocks')
      .select('centroid_lat, centroid_lng')
      .eq('id', blockId)
      .eq('farm_id', farmId)
      .maybeSingle();
    if (error) throw error;
    if (data?.centroid_lat != null && data?.centroid_lng != null) {
      return {
        lat: Number(data.centroid_lat),
        lng: Number(data.centroid_lng),
        source: 'farm',
      };
    }
  }

  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('centroid_lat, centroid_lng')
    .eq('farm_id', farmId)
    .not('centroid_lat', 'is', null)
    .not('centroid_lng', 'is', null)
    .limit(20);
  if (blocksError) throw blocksError;

  const points = (blocks ?? []).filter((b) => b.centroid_lat != null && b.centroid_lng != null);
  if (points.length) {
    const avgLat = points.reduce((s, b) => s + Number(b.centroid_lat), 0) / points.length;
    const avgLng = points.reduce((s, b) => s + Number(b.centroid_lng), 0) / points.length;
    return { lat: avgLat, lng: avgLng, source: 'farm' };
  }

  const { data: farm } = await supabase
    .from('farms')
    .select('country, district, location')
    .eq('id', farmId)
    .maybeSingle();
  const region = coordsForCountry(farm?.country);
  return {
    lat: region.lat,
    lng: region.lng,
    source: 'region',
    regionLabel: region.label,
  };
}

export async function GET(request: NextRequest) {
  return withPermission(undefined, async ({ can }) => {
    if (!can('activities.view') && !can('activities.record') && !can('farm.view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawLat = searchParams.get('lat') ? Number(searchParams.get('lat')) : NaN;
    const rawLng = searchParams.get('lng') ? Number(searchParams.get('lng')) : NaN;
    const date = searchParams.get('date') || undefined;
    const blockId = searchParams.get('block_id');
    const daysParam = searchParams.get('days');
    const wantForecast = daysParam != null || searchParams.get('forecast') === '1';

    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
      throw new HttpError('Use a valid forecast date (YYYY-MM-DD).', 400);
    }

    const resolved = await resolveFarmCoords(rawLat, rawLng, blockId);
    const { lat, lng, source, regionLabel } = resolved;

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new HttpError('Latitude or longitude is outside its valid range.', 400);
    }

    try {
      if (wantForecast) {
        const days = daysParam ? Number(daysParam) : 7;
        const forecast = await fetchWeatherForecast(lat, lng, Number.isFinite(days) ? days : 7);
        return NextResponse.json({
          forecast,
          weather: forecast.current,
          lat,
          lng,
          source,
          regionLabel: regionLabel ?? null,
        });
      }
      const weather = await fetchWeatherSnapshot(lat, lng, date);
      return NextResponse.json({ weather, lat, lng, source, regionLabel: regionLabel ?? null });
    } catch {
      throw new HttpError('Forecast unavailable right now. Try again shortly.', 502);
    }
  });
}

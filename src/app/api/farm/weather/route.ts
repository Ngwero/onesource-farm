import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { HttpError } from '@/lib/farm/http';
import { fetchWeatherSnapshot } from '@/lib/farm/weather';

export async function GET(request: NextRequest) {
  return withPermission(undefined, async ({ can }) => {
    if (!can('activities.view') && !can('activities.record') && !can('farm.view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : NaN;
    let lng = searchParams.get('lng') ? Number(searchParams.get('lng')) : NaN;
    const date = searchParams.get('date') || undefined;
    const blockId = searchParams.get('block_id');
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
      throw new HttpError('Use a valid forecast date (YYYY-MM-DD).', 400);
    }

    if (blockId && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
      const supabase = createServiceClient();
      const farmId = await getCurrentFarmId();
      const { data, error } = await supabase
        .from('blocks')
        .select('centroid_lat, centroid_lng')
        .eq('id', blockId)
        .eq('farm_id', farmId)
        .maybeSingle();
      if (error) throw error;
      if (data?.centroid_lat != null && data?.centroid_lng != null) {
        lat = Number(data.centroid_lat);
        lng = Number(data.centroid_lng);
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: 'Provide lat/lng or a block with a saved GPS location.' },
        { status: 400 }
      );
    }

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new HttpError('Latitude or longitude is outside its valid range.', 400);
    }
    let weather;
    try {
      weather = await fetchWeatherSnapshot(lat, lng, date);
    } catch {
      throw new HttpError('Forecast unavailable for this date. Try a date within the forecast range.', 502);
    }
    return NextResponse.json({ weather, lat, lng });
  });
}

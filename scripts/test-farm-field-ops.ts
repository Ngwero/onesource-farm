import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { polygonCentroid, type BlockPolygon } from '../src/lib/farm/geometry';
import { blockSchema } from '../src/lib/farm/schemas';
import { scoreSprayWindow, fetchWeatherSnapshot } from '../src/lib/farm/weather';
import { processFarmReportDigests, shouldSendNow, type DigestSubscription } from '../src/lib/farm/digests';
import { canExportReport } from '../src/lib/farm/reportTypes';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeCron } from '../src/lib/cron/auth';

const square: BlockPolygon = { type: 'Polygon', coordinates: [[[32, 0], [34, 0], [34, 2], [32, 2], [32, 0]]] };
const block = { code: 'A', name: 'North', size_value: 2, size_unit: 'acres', status: 'active' };

test('centroid excludes repeated closing vertex and handles winding and holes', () => {
  assert.deepEqual(polygonCentroid(square), { lng: 33, lat: 1 });
  assert.deepEqual(polygonCentroid({ ...square, coordinates: [[...square.coordinates[0]].reverse()] }), { lng: 33, lat: 1 });
  const withHole: BlockPolygon = { type: 'Polygon', coordinates: [
    [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
    [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]],
  ] };
  assert.ok(Math.abs(polygonCentroid(withHole)!.lng - 5 / 3) < 1e-10);
  assert.equal(polygonCentroid({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [2, 2], [0, 0]]] }), null);
});

test('block API validates GeoJSON and calculates the centroid instead of trusting the client', () => {
  const saved = blockSchema.parse({ ...block, boundary_geojson: square, centroid_lat: 9, centroid_lng: 9 });
  assert.equal(saved.centroid_lat, 1);
  assert.equal(saved.centroid_lng, 33);
  for (const ring of [[], [[0, 0], [1, 0], [0, 1]], [[0, 0], [200, 0], [0, 1], [0, 0]], [[0, 0], [1, 1], [2, 2], [0, 0]]]) {
    assert.equal(blockSchema.safeParse({ ...block, boundary_geojson: { type: 'Polygon', coordinates: [ring] } }).success, false);
  }
  assert.equal(blockSchema.safeParse({ ...block, centroid_lat: 0 }).success, false);
});

test('spray scoring rejects missing data, precipitation, storms, and excessive wind', () => {
  const mild = { tempC: 24, windKmh: 6, precipMm: 0, weatherCode: 0 };
  assert.equal(scoreSprayWindow(mild).score, 100);
  assert.equal(scoreSprayWindow({ ...mild, tempC: null }).label, 'No forecast');
  for (const conditions of [{ windKmh: 25 }, { precipMm: 1 }, { weatherCode: 95 }]) {
    assert.equal(scoreSprayWindow({ ...mild, ...conditions }).label, 'Poor spray window');
  }
});

test('forecast uses the selected local 09:00 hour and handles incomplete provider data', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ hourly: {
      time: ['2026-11-03T08:00', '2026-11-03T09:00'], temperature_2m: [20, 24],
      relative_humidity_2m: [70, 65], precipitation: [0, 0], wind_speed_10m: [5, 6], weather_code: [0, 1],
    } });
    const weather = await fetchWeatherSnapshot(0, 32, '2026-11-03');
    assert.equal(weather.tempC, 24);
    assert.equal(weather.sprayScore, 100);
    globalThis.fetch = async () => Response.json({ hourly: { time: ['2026-11-03T09:00'] } });
    assert.equal((await fetchWeatherSnapshot(0, 32)).sprayLabel, 'No forecast');
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(fetchWeatherSnapshot(0, 32), /Weather provider error/);
  } finally { globalThis.fetch = original; }
});

const sub: DigestSubscription = { id: 's', farm_id: 'f', user_id: 'u', email: 'a@example.com', report_types: ['activities'], cadence: 'daily', weekday: 1, hour_utc: 6, is_active: true, last_sent_at: null };
test('digest schedules respect UTC hour, weekly day, pause, and same-day retries', () => {
  const now = new Date('2026-11-03T06:05:00Z');
  assert.equal(shouldSendNow(sub, now), true);
  assert.equal(shouldSendNow({ ...sub, hour_utc: 7 }, now), false);
  assert.equal(shouldSendNow({ ...sub, is_active: false }, now), false);
  assert.equal(shouldSendNow({ ...sub, cadence: 'weekly', weekday: 1 }, now), false);
  assert.equal(shouldSendNow({ ...sub, cadence: 'weekly', weekday: 2 }, now), true);
  assert.equal(shouldSendNow({ ...sub, last_sent_at: '2026-11-03T06:00:00Z' }, now), false);
  assert.equal(shouldSendNow({ ...sub, last_sent_at: '2026-11-02T06:00:00Z' }, now), true);
});

test('report permissions require export plus domain access', () => {
  assert.equal(canExportReport('workers', (p) => p === 'reports.export'), false);
  assert.equal(canExportReport('workers', (p) => p === 'workforce.view'), false);
  assert.equal(canExportReport('workers', (p) => ['reports.export', 'workforce.view'].includes(p)), true);
  assert.equal(canExportReport('stock', (p) => ['reports.export', 'packing.view'].includes(p)), true);
});

test('cron accepts only the configured bearer token', () => {
  const previous = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'test-cron-secret';
    assert.equal(authorizeCron(new NextRequest('https://example.com/api/cron/farm-reports', { headers: { authorization: 'Bearer test-cron-secret' } })), null);
    assert.equal(authorizeCron(new NextRequest('https://example.com/api/cron/farm-reports?secret=test-cron-secret'))?.status, 401);
    assert.equal(authorizeCron(new NextRequest('https://example.com/api/cron/sla', { headers: { authorization: 'Bearer wrong' } }))?.status, 401);
    delete process.env.CRON_SECRET;
    assert.equal(authorizeCron(new NextRequest('https://example.com/api/cron/sla'))?.status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});


test('an overlapping digest job skips delivery when another job holds the lease', async () => {
  const due = { ...sub, hour_utc: new Date().getUTCHours(), updated_at: '2026-11-03T00:00:00Z' };
  let claimed = false;
  const conditions: unknown[][] = [];
  const db = {
    from(table: string) {
      assert.ok(['system_settings', 'report_digest_subscriptions'].includes(table));
      const query = {
        select() { return query; },
        eq(...args: unknown[]) { conditions.push(args); return query; },
        is(...args: unknown[]) { conditions.push(args); return query; },
        or(filter: string) { assert.match(filter, /sending_started_at.is.null/); return query; },
        update() { claimed = true; return query; },
        async maybeSingle() { return { data: null, error: null }; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ data: [due], error: null })); },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  assert.deepEqual(await processFarmReportDigests(db), { checked: 1, sent: 0, failed: 0, skipped: 1 });
  assert.equal(claimed, true);
  assert.ok(conditions.some(([column]) => column === 'last_sent_at'));
  assert.ok(conditions.some(([column]) => column === 'updated_at'));
});

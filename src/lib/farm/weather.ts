/** Open-Meteo weather + spray-window scoring (no API key). */

export type WeatherSnapshot = {
  tempC: number | null;
  windKmh: number | null;
  precipMm: number | null;
  humidityPct: number | null;
  weatherCode: number | null;
  summary: string;
  source: 'open-meteo';
  time?: string;
  sprayScore: number;
  sprayLabel: string;
  sprayReasons: string[];
};

export type SprayWindow = {
  start: string;
  end: string;
  score: number;
  label: 'Favorable window' | 'Check conditions';
};

export type HourlyForecast = {
  time: string;
  tempC: number | null;
  windKmh: number | null;
  precipMm: number | null;
  weatherCode: number | null;
  isDay: boolean;
};

export type DailyForecast = {
  date: string;
  weatherCode: number | null;
  label: string;
  tempMaxC: number | null;
  tempMinC: number | null;
  precipMm: number | null;
  windMaxKmh: number | null;
  sprayWindows: SprayWindow[];
  sprayReasons: string[];
  assessedHours: number;
  sprayScore: number;
  sprayLabel: string;
};

export type WeatherForecast = {
  current: WeatherSnapshot;
  days: DailyForecast[];
  timezone: string;
  fetchedAt: string;
  source: 'open-meteo';
};

export const WMO: Record<number, string> = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy rain showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Heavy thunderstorm with hail',
};

export function weatherLabel(code: number | null): string {
  if (code == null) return '—';
  return WMO[code] || `Code ${code}`;
}

/** Approximate HQ coords when device/block GPS is unavailable — forecast always works. */
const REGION_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  UG: { lat: 0.3476, lng: 32.5825, label: 'Uganda' },
  Uganda: { lat: 0.3476, lng: 32.5825, label: 'Uganda' },
  KE: { lat: -1.2921, lng: 36.8219, label: 'Kenya' },
  Kenya: { lat: -1.2921, lng: 36.8219, label: 'Kenya' },
  TZ: { lat: -6.163, lng: 35.7516, label: 'Tanzania' },
  Tanzania: { lat: -6.163, lng: 35.7516, label: 'Tanzania' },
  RW: { lat: -1.9441, lng: 30.0619, label: 'Rwanda' },
  Rwanda: { lat: -1.9441, lng: 30.0619, label: 'Rwanda' },
};

export const DEFAULT_FARM_COORDS = REGION_COORDS.UG;

export function coordsForCountry(country: string | null | undefined): {
  lat: number;
  lng: number;
  label: string;
} {
  if (!country) return { ...DEFAULT_FARM_COORDS };
  const key = country.trim();
  return REGION_COORDS[key] ?? REGION_COORDS[key.toUpperCase()] ?? { ...DEFAULT_FARM_COORDS };
}

function summarize(code: number | null, temp: number | null, wind: number | null): string {
  const parts = [
    code != null ? WMO[code] || `Code ${code}` : null,
    temp != null ? `${temp.toFixed(1)}°C` : null,
    wind != null ? `wind ${wind.toFixed(0)} km/h` : null,
  ].filter(Boolean);
  return parts.join(', ') || 'Weather unavailable';
}

/**
 * Spray window heuristic for export crops:
 * prefer dry, mild, light wind; avoid rain, fog, high wind, extreme heat.
 */
export function scoreSprayWindow(input: {
  tempC: number | null;
  windKmh: number | null;
  precipMm: number | null;
  weatherCode: number | null;
}): { score: number; label: string; reasons: string[] } {
  if ([input.tempC, input.windKmh, input.precipMm, input.weatherCode].some((value) => value == null || !Number.isFinite(value))) {
    return { score: 0, label: 'No forecast', reasons: ['Incomplete weather data'] };
  }
  let score = 100;
  const reasons: string[] = [];
  const { tempC, windKmh, precipMm, weatherCode } = input;

  if (precipMm != null && precipMm > 0.2) {
    score -= Math.min(50, 20 + precipMm * 10);
    reasons.push('Precipitation forecast');
  }
  if (windKmh != null) {
    if (windKmh > 20) {
      score -= 40;
      reasons.push('Wind too strong for spraying');
    } else if (windKmh > 12) {
      score -= 15;
      reasons.push('Moderate wind');
    }
  }
  if (tempC != null) {
    if (tempC < 10) {
      score -= 20;
      reasons.push('Cool conditions');
    } else if (tempC > 32) {
      score -= 25;
      reasons.push('Hot conditions — drift / volatility risk');
    }
  }
  if (weatherCode != null && [45, 48, 95, 96, 99].includes(weatherCode)) {
    score -= 30;
    reasons.push('Fog or thunderstorm risk');
  }

  const rainOrSnow = weatherCode != null && weatherCode >= 51 && weatherCode <= 86;
  if (rainOrSnow && !reasons.includes('Precipitation forecast')) {
    reasons.push(weatherCode! >= 71 && ![80, 81, 82].includes(weatherCode!) ? 'Snow forecast' : 'Rain forecast');
  }
  if (rainOrSnow || (windKmh != null && windKmh > 20) || (precipMm != null && precipMm > 0.2) ||
      (weatherCode != null && [45, 48, 95, 96, 99].includes(weatherCode))) score = Math.min(score, 40);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label =
    score >= 80 ? 'Good spray window' : score >= 55 ? 'Marginal spray window' : 'Poor spray window';
  if (!reasons.length && score >= 80) reasons.push('Dry, mild, light wind');
  return { score, label, reasons };
}

export async function fetchWeatherSnapshot(
  lat: number,
  lng: number,
  dateIso?: string
): Promise<WeatherSnapshot> {
  const date = dateIso || new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
    timezone: 'auto',
    start_date: date,
    end_date: date,
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Weather provider error (${res.status})`);
  const data = (await res.json()) as {
    hourly?: {
      time: string[];
      temperature_2m: (number | null)[];
      relative_humidity_2m: (number | null)[];
      precipitation: (number | null)[];
      wind_speed_10m: (number | null)[];
      weather_code: (number | null)[];
    };
  };
  const hourly = data.hourly;
  if (!hourly?.time?.length) {
    return {
      tempC: null,
      windKmh: null,
      precipMm: null,
      humidityPct: null,
      weatherCode: null,
      summary: 'No forecast for this date',
      source: 'open-meteo',
      sprayScore: 0,
      sprayLabel: 'No forecast',
      sprayReasons: ['Missing hourly data'],
    };
  }

  // Prefer mid-morning hour (~09:00) for spray decisions.
  let idx = hourly.time.findIndex((t) => t.includes('T09:00'));
  if (idx < 0) idx = Math.min(9, hourly.time.length - 1);

  const tempC = hourly.temperature_2m?.[idx] ?? null;
  const humidityPct = hourly.relative_humidity_2m?.[idx] ?? null;
  const precipMm = hourly.precipitation?.[idx] ?? null;
  const windKmh = hourly.wind_speed_10m?.[idx] ?? null;
  const weatherCode = hourly.weather_code?.[idx] ?? null;
  const spray = scoreSprayWindow({ tempC, windKmh, precipMm, weatherCode });

  return {
    tempC,
    windKmh,
    precipMm,
    humidityPct,
    weatherCode,
    summary: summarize(weatherCode, tempC, windKmh),
    source: 'open-meteo',
    sprayScore: spray.score,
    sprayLabel: spray.label,
    sprayReasons: spray.reasons,
  };
}

/** Find continuous daylight periods using hourly conditions, never daily rain totals.
 * Two hours of workable weather plus a two-hour dry outlook are required.
 * Times remain in the provider's local timezone, without browser-timezone conversion.
 */
export function dailySprayOutlook(date: string, hours: HourlyForecast[], localNow?: string, sunset?: string) {
  const candidates = hours.filter((hour) => hour.time.startsWith(date) && hour.isDay &&
    (!localNow || hour.time >= localNow) && (!sunset ||
      new Date(`${hour.time}Z`).getTime() + 3_600_000 <= new Date(`${sunset}Z`).getTime()));
  const reasons = new Map<string, number>();
  let assessedHours = 0;
  const evaluated = candidates.map((hour) => {
    const result = scoreSprayWindow(hour);
    if (result.label === 'No forecast') return { hour, score: null };
    // Ensure the two following hours are present, contiguous, and dry as well.
    const index = hours.indexOf(hour);
    const ahead = hours.slice(index + 1, index + 3);
    const expected = new Date(`${hour.time}Z`).getTime();
    const complete = ahead.length === 2 && ahead.every((next, offset) =>
      new Date(`${next.time}Z`).getTime() === expected + (offset + 1) * 3_600_000 &&
      next.precipMm != null && Number.isFinite(next.precipMm) && next.weatherCode != null && Number.isFinite(next.weatherCode));
    if (!complete) return { hour, score: null };
    assessedHours += 1;
    const wetSoon = ahead.some((next) => next.precipMm! > 0.2 ||
      (next.weatherCode! >= 51 && next.weatherCode! <= 86) || [95, 96, 99].includes(next.weatherCode!));
    const score = wetSoon ? Math.min(40, result.score) : result.score;
    const why = wetSoon ? ['Rain within the next 2 hours'] : result.reasons;
    if (score < 80) for (const reason of why) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    return { hour, score };
  });
  const windows: SprayWindow[] = [];
  let run: typeof evaluated = [];
  function finish() {
    if (run.length >= 2) {
      const end = new Date(`${run[run.length - 1].hour.time}Z`);
      end.setUTCHours(end.getUTCHours() + 1);
      const score = Math.min(...run.map((item) => item.score!));
      windows.push({ start: run[0].hour.time, end: end.toISOString().slice(0, 16), score,
        label: score >= 80 ? 'Favorable window' : 'Check conditions' });
    }
    run = [];
  }
  for (const item of evaluated) {
    const previous = run[run.length - 1];
    if (item.score == null || item.score < 55) { finish(); continue; }
    const contiguous = !previous || new Date(`${item.hour.time}Z`).getTime() -
      new Date(`${previous.hour.time}Z`).getTime() === 3_600_000;
    if (!contiguous) finish();
    run.push(item);
  }
  finish();
  windows.sort((a, b) => b.score - a.score || a.start.localeCompare(b.start));
  const best = windows[0];
  const why = [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([reason]) => reason);
  return {
    sprayWindows: windows,
    sprayScore: best?.score ?? 0,
    sprayLabel: best?.label ?? (assessedHours ? 'No suitable window' : candidates.length || !hours.some((hour) => hour.time.startsWith(date)) ? 'Data unavailable' : 'No daylight hours left'),
    sprayReasons: best ? (best.score >= 80 ? ['Dry, mild conditions during this window'] : why) :
      (why.length ? why : [assessedHours ? 'No continuous 2-hour window' : 'No complete upcoming daylight forecast']),
    assessedHours,
  };
}

/** Daily weather summaries with hourly spray-window assessments. */
export async function fetchWeatherForecast(
  lat: number,
  lng: number,
  days = 7
): Promise<WeatherForecast> {
  const horizon = Math.max(1, Math.min(14, Math.round(days)));
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lng),
    current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
    hourly: 'temperature_2m,precipitation,wind_speed_10m,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunset',
    forecast_days: String(horizon), timezone: 'auto',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    next: { revalidate: 900 }, signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Weather provider error (${res.status})`);
  type Series = { time: string[]; sunset?: string[]; temperature_2m?: (number | null)[]; wind_speed_10m?: (number | null)[]; precipitation?: (number | null)[]; weather_code?: (number | null)[]; is_day?: (number | null)[]; temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[]; precipitation_sum?: (number | null)[]; wind_speed_10m_max?: (number | null)[] };
  const data = (await res.json()) as {
    timezone?: string;
    current?: { time?: string; temperature_2m?: number | null; relative_humidity_2m?: number | null;
      precipitation?: number | null; wind_speed_10m?: number | null; weather_code?: number | null };
    hourly?: Series;
    daily?: Series;
  };
  const cur = data.current ?? {};
  const tempC = cur.temperature_2m ?? null;
  const humidityPct = cur.relative_humidity_2m ?? null;
  const precipMm = cur.precipitation ?? null;
  const windKmh = cur.wind_speed_10m ?? null;
  const weatherCode = cur.weather_code ?? null;
  const spray = scoreSprayWindow({ tempC, windKmh, precipMm, weatherCode });
  const current: WeatherSnapshot = {
    tempC, humidityPct, precipMm, windKmh, weatherCode, time: cur.time,
    summary: summarize(weatherCode, tempC, windKmh), source: 'open-meteo',
    sprayScore: spray.score, sprayLabel: spray.label, sprayReasons: spray.reasons,
  };
  const hourly = data.hourly;
  const hours: HourlyForecast[] = (hourly?.time ?? []).map((time, i) => ({
    time, tempC: hourly?.temperature_2m?.[i] ?? null, windKmh: hourly?.wind_speed_10m?.[i] ?? null,
    precipMm: hourly?.precipitation?.[i] ?? null, weatherCode: hourly?.weather_code?.[i] ?? null,
    isDay: hourly?.is_day?.[i] === 1,
  }));
  const daily = data.daily;
  const daysOut: DailyForecast[] = (daily?.time ?? []).map((date, i) => {
    const code = daily?.weather_code?.[i] ?? null;
    return { date, weatherCode: code, label: weatherLabel(code),
      tempMaxC: daily?.temperature_2m_max?.[i] ?? null, tempMinC: daily?.temperature_2m_min?.[i] ?? null,
      precipMm: daily?.precipitation_sum?.[i] ?? null, windMaxKmh: daily?.wind_speed_10m_max?.[i] ?? null,
      ...dailySprayOutlook(date, hours, cur.time, daily?.sunset?.[i]),
    };
  });
  return { current, days: daysOut, source: 'open-meteo', timezone: data.timezone ?? 'Local time', fetchedAt: new Date().toISOString() };
}

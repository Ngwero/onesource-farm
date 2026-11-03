/** Open-Meteo weather + spray-window scoring (no API key). */

export type WeatherSnapshot = {
  tempC: number | null;
  windKmh: number | null;
  precipMm: number | null;
  humidityPct: number | null;
  weatherCode: number | null;
  summary: string;
  source: 'open-meteo';
  sprayScore: number;
  sprayLabel: string;
  sprayReasons: string[];
};

const WMO: Record<number, string> = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  80: 'Rain showers',
  95: 'Thunderstorm',
};

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
  if (Object.values(input).some((value) => value == null || !Number.isFinite(value))) {
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

  if ((windKmh != null && windKmh > 20) || (precipMm != null && precipMm > 0.2) ||
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

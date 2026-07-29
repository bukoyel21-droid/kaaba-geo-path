import type { Location, QiblaResult } from "@/types";

const KAABA: Location = { lat: 21.422487, lng: 39.826206 };

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function normalizeBearing(bearing: number): number {
  return ((bearing % 360) + 360) % 360;
}

export function getCardinalDirection(degrees: number): string {
  const directions = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return `${degrees.toFixed(1)}° ${directions[index]}`;
}

export function calculateGreatCircleBearing(from: Location): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(KAABA.lat);
  const Δλ = toRad(KAABA.lng - from.lng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return normalizeBearing(toDeg(Math.atan2(y, x)));
}

export function calculateRhumbLineBearing(from: Location): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(KAABA.lat);
  let Δλ = toRad(KAABA.lng - from.lng);

  const Δψ = Math.log(
    Math.tan(Math.PI / 4 + φ2 / 2) / Math.tan(Math.PI / 4 + φ1 / 2)
  );

  if (Math.abs(Δλ) > Math.PI) {
    Δλ = Δλ > 0 ? -(2 * Math.PI - Δλ) : 2 * Math.PI + Δλ;
  }

  return normalizeBearing(toDeg(Math.atan2(Δλ, Δψ)));
}

export function calculateHaversineDistance(from: Location): number {
  const R = 6371; // Earth's radius in km
  const φ1 = toRad(from.lat);
  const φ2 = toRad(KAABA.lat);
  const Δφ = toRad(KAABA.lat - from.lat);
  const Δλ = toRad(KAABA.lng - from.lng);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateQibla(from: Location): QiblaResult {
  const greatCircleBearing = calculateGreatCircleBearing(from);
  const rhumbLineBearing = calculateRhumbLineBearing(from);
  const distanceKm = calculateHaversineDistance(from);
  const distanceMiles = distanceKm * 0.621371;

  return {
    bearing: greatCircleBearing,
    bearingDegrees: greatCircleBearing,
    cardinalDirection: getCardinalDirection(greatCircleBearing),
    distanceKm: Math.round(distanceKm * 10) / 10,
    distanceMiles: Math.round(distanceMiles * 10) / 10,
    greatCircleBearing: Math.round(greatCircleBearing * 10) / 10,
    rhumbLineBearing: Math.round(rhumbLineBearing * 10) / 10,
  };
}

export function getGeodesicPoints(from: Location, numPoints: number = 100): Location[] {
  const points: Location[] = [];
  const φ1 = toRad(from.lat);
  const φ2 = toRad(KAABA.lat);
  const λ1 = toRad(from.lng);
  const λ2 = toRad(KAABA.lng);
  const d = calculateHaversineDistance(from);
  const R = 6371;
  const δ = d / R;

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const a = Math.sin((1 - f) * δ) / Math.sin(δ);
    const b = Math.sin(f * δ) / Math.sin(δ);
    const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
    const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
    const z = a * Math.sin(φ1) + b * Math.sin(φ2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lng = toDeg(Math.atan2(y, x));
    points.push({ lat, lng });
  }
  return points;
}

export function calculatePrayerTimes(lat: number, lng: number, date: Date = new Date()): {
  fajr: string; sunrise: string; dhuhr: string; asr: string; maghrib: string; isha: string;
} {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );

  const d = (2 * Math.PI * dayOfYear) / 365;
  const declination =
    0.006918 -
    0.399912 * Math.cos(d) +
    0.070257 * Math.sin(d) -
    0.006758 * Math.cos(2 * d) +
    0.000907 * Math.sin(2 * d) -
    0.002697 * Math.cos(3 * d) +
    0.00148 * Math.sin(3 * d);

  const φ = toRad(lat);
  const δ = declination;
  const λ = lng;
  const tz = Math.round(lng / 15);

  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(d) -
      0.032077 * Math.sin(d) -
      0.014615 * Math.cos(2 * d) -
      0.04089 * Math.sin(2 * d));

  const solarNoon = 12 + tz - λ / 15 - equationOfTime / 60;

  const ha = (angle: number) =>
    Math.acos(
      (Math.sin(toRad(angle)) - Math.sin(φ) * Math.sin(δ)) /
        (Math.cos(φ) * Math.cos(δ))
    );

  const sunriseHA = ha(90.833);
  const sunrise = solarNoon - toDeg(sunriseHA) / 15;
  const sunset = solarNoon + toDeg(sunriseHA) / 15;

  const fajrAngle = ha(108);
  const fajr = solarNoon - toDeg(fajrAngle) / 15;
  const ishaAngle = ha(108);
  const isha = solarNoon + toDeg(ishaAngle) / 15;

  const asrAngle = Math.acos(
    (Math.sin(Math.atan(1 / (1 + Math.tan(Math.abs(φ - δ))))) -
      Math.sin(φ) * Math.sin(δ)) /
      (Math.cos(φ) * Math.cos(δ))
  );
  const asr = solarNoon + toDeg(asrAngle) / 15;

  const fmt = (h: number) => {
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
  };

  return {
    fajr: fmt(fajr),
    sunrise: fmt(sunrise),
    dhuhr: fmt(solarNoon),
    asr: fmt(asr),
    maghrib: fmt(sunset),
    isha: fmt(isha),
  };
}
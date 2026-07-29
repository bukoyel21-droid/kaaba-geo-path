export interface Location {
  lat: number;
  lng: number;
  name?: string;
}

export interface Mosque {
  id: string;
  name: string;
  nameAr?: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  description: string;
  imageUrl: string;
  isFamous?: boolean;
}

export interface QiblaResult {
  bearing: number;
  bearingDegrees: number;
  cardinalDirection: string;
  distanceKm: number;
  distanceMiles: number;
  greatCircleBearing: number;
  rhumbLineBearing: number;
}

export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export type MapStyle = "dark" | "light" | "satellite";

export interface Coordinates {
  lat: number;
  lng: number;
}
/**
 * Geographic helpers.
 *
 * Internally we work in meters (that's what OBA returns), but display in
 * imperial (feet / miles). Two conversion constants matter:
 *   1 meter    = 3.28084 feet
 *   1 mile     = 1609.344 meters
 */

import type { LatLng } from "@/types";

const EARTH_RADIUS_M = 6_371_000;
const M_PER_MILE = 1609.344;
const FT_PER_M = 3.28084;

/** Haversine distance between two points in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Format a distance (meters) as an imperial string.
 *   < 0.1 mi (528 ft) → feet, rounded to nearest 10
 *   otherwise → miles, 1 decimal below 10 mi, whole above
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  const feet = meters * FT_PER_M;
  if (feet < 528) return `${Math.max(10, Math.round(feet / 10) * 10)} ft`;
  const miles = meters / M_PER_MILE;
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

/** Just the feet portion, for spoken/notification copy ("Walk 300 feet"). */
export function metersToFeet(meters: number): number {
  return Math.round(meters * FT_PER_M);
}

/** Approximate walking time in seconds, assuming ~1.35 m/s (avg walker). */
export function walkingTimeSec(meters: number): number {
  return Math.max(30, Math.round(meters / 1.35));
}

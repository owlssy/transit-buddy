/**
 * Google encoded polyline decoder. OBA returns route shapes in this format
 * inside `references.polylines` on `stops-for-route`.
 *
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */

import type { LatLng } from "@/types";
import { haversine } from "./distance";

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

// A straight line from a board stop to an alight stop can cut straight
// across a lake, the Sound, a block of buildings, etc. — it's a "crow
// flies" line, not the transit line. Real route shapes exist (OBA returns
// them per-route), so instead we snap a ride leg onto the shape segment
// that actually passes near both of its stops.
const SNAP_MAX_M = 500;

function nearestPointOnPath(path: LatLng[], point: LatLng): { index: number; distanceM: number } {
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = haversine(point, path[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  return { index: bestIndex, distanceM: bestDist };
}

/**
 * Picks whichever decoded route-shape segment best matches a ride leg (by
 * proximity to its board/alight stops — a route can have multiple shapes,
 * one per direction/branch) and returns just the portion of that shape
 * between them, in board→alight order. Returns null if no segment passes
 * within SNAP_MAX_M of both stops, so the caller can fall back to a
 * straight line rather than show a bogus snap.
 */
export function snapRideLegToShape(
  segments: LatLng[][],
  board: LatLng,
  alight: LatLng,
): LatLng[] | null {
  let best: { path: LatLng[]; score: number } | null = null;

  for (const seg of segments) {
    if (seg.length < 2) continue;
    const nearBoard = nearestPointOnPath(seg, board);
    const nearAlight = nearestPointOnPath(seg, alight);
    if (nearBoard.distanceM > SNAP_MAX_M || nearAlight.distanceM > SNAP_MAX_M) continue;

    const score = nearBoard.distanceM + nearAlight.distanceM;
    if (best && score >= best.score) continue;

    const forward = nearBoard.index <= nearAlight.index;
    const [start, end] = forward
      ? [nearBoard.index, nearAlight.index]
      : [nearAlight.index, nearBoard.index];
    const slice = seg.slice(start, end + 1);
    best = { path: forward ? slice : [...slice].reverse(), score };
  }

  return best?.path ?? null;
}

/**
 * Typed OneBusAway API surface used by the app.
 *
 * Endpoint paths follow the OBA REST spec — if your OBA server uses different
 * paths (some regional servers customize `/api/where/*`), only these functions
 * need to change. Callers stay untouched.
 *
 * OBA REST spec: https://developer.onebusaway.org/api/where
 */

import { obaRequest, type OBAEntryPayload, type OBAListPayload } from "./client";
import type {
  OBAArrivalDeparture,
  OBAArrivalsForStop,
  OBARoute,
  OBAStop,
  OBATripDetails,
  OBAVehicleStatus,
  OBASituation,
  LatLng,
} from "@/types";

// ---------------- Stops ----------------

/**
 * Get a stop by ID.
 * NOTE: OBA IDs are agency-scoped, e.g. `1_29260` for Metro.
 */
export function getStop(stopId: string) {
  return obaRequest<OBAEntryPayload<OBAStop>>(`/api/where/stop/${stopId}.json`);
}

/**
 * Find stops near a point. `radius` is meters (default 400).
 * Some OBA servers cap radius (~800m).
 *
 * Endpoint: /api/where/stops-for-location.json
 */
export function getNearbyStops(
  location: LatLng,
  opts: { radius?: number; maxCount?: number } = {},
) {
  return obaRequest<OBAListPayload<OBAStop>>("/api/where/stops-for-location.json", {
    lat: location.latitude,
    lon: location.longitude,
    radius: opts.radius ?? 400,
    maxCount: opts.maxCount ?? 20,
  });
}

/**
 * Free-text stop search. The OBA "stops-for-location" endpoint supports a
 * `query` param that matches on stop code/name near a location.
 *
 * If your OBA server exposes a dedicated `/api/where/search/stop.json` endpoint,
 * you can swap it in here.
 */
export function searchStops(query: string, near: LatLng) {
  return obaRequest<OBAListPayload<OBAStop>>("/api/where/stops-for-location.json", {
    lat: near.latitude,
    lon: near.longitude,
    query,
    radius: 15000,
    maxCount: 25,
  });
}

// ---------------- Routes ----------------

export function getRoute(routeId: string) {
  return obaRequest<OBAEntryPayload<OBARoute>>(`/api/where/route/${routeId}.json`);
}

/**
 * Search routes by short name or long name.
 * Endpoint: /api/where/routes-for-location.json (supports `query`)
 */
export function searchRoutes(query: string, near: LatLng) {
  return obaRequest<OBAListPayload<OBARoute>>("/api/where/routes-for-location.json", {
    lat: near.latitude,
    lon: near.longitude,
    query,
    radius: 20000,
  });
}

/**
 * All stops served by a given route (with a polyline in `references.polylines`).
 */
export function getRouteStops(routeId: string) {
  return obaRequest<
    OBAEntryPayload<{
      routeId: string;
      stopIds: string[];
      stopGroupings?: unknown[];
      polylines?: Array<{ length: number; levels: string; points: string }>;
    }>
  >(`/api/where/stops-for-route/${routeId}.json`, { includePolylines: true });
}

// ---------------- Arrivals ----------------

/**
 * Real-time arrivals & departures for a stop.
 * `minutesBefore`/`minutesAfter` bound the prediction window.
 */
export function getArrivals(
  stopId: string,
  opts: { minutesBefore?: number; minutesAfter?: number } = {},
) {
  return obaRequest<OBAEntryPayload<OBAArrivalsForStop>>(
    `/api/where/arrivals-and-departures-for-stop/${stopId}.json`,
    {
      minutesBefore: opts.minutesBefore ?? 2,
      minutesAfter: opts.minutesAfter ?? 60,
    },
  );
}

/**
 * A single arrival — useful once we know the trip/stop pair we're tracking.
 */
export function getArrivalAndDeparture(
  stopId: string,
  tripId: string,
  serviceDate: number,
  vehicleId?: string,
) {
  return obaRequest<OBAEntryPayload<OBAArrivalDeparture>>(
    `/api/where/arrival-and-departure-for-stop/${stopId}.json`,
    { tripId, serviceDate, vehicleId },
  );
}

// ---------------- Trip / Vehicle ----------------

export function getTripDetails(tripId: string) {
  return obaRequest<OBAEntryPayload<OBATripDetails>>(
    `/api/where/trip-details/${tripId}.json`,
    { includeSchedule: true, includeStatus: true, includeTrip: true },
  );
}

export function getVehiclePosition(vehicleId: string) {
  return obaRequest<OBAEntryPayload<OBAVehicleStatus>>(
    `/api/where/vehicle/${vehicleId}.json`,
  );
}

// ---------------- Service alerts ----------------

/**
 * OBA returns service alerts inline in `references.situations` on most
 * endpoints. To fetch alerts for a specific agency directly, use this.
 *
 * NOTE: some OBA servers don't expose this dedicated endpoint. If it 404s,
 * fall back to reading `references.situations` from arrivals/route calls.
 */
export function getServiceAlerts(agencyId: string) {
  return obaRequest<OBAListPayload<OBASituation>>(
    `/api/where/situations-for-agency/${agencyId}.json`,
  );
}

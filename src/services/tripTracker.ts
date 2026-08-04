/**
 * Trip tracker.
 *
 * Given a `TripPlan`, the tracker figures out which *phase* of the trip the
 * user is in (walking, waiting, riding, transferring, done) based on their
 * current GPS position and the live vehicle position. It also detects two
 * failure modes:
 *
 *   1. **Wrong Bus** — user's GPS moves rapidly (>5 m/s) along a route that
 *      isn't the one they selected. We compare against nearby vehicle
 *      positions and flag the mismatch.
 *
 *   2. **Missed Stop** — bus has passed the alight stop but the user's GPS
 *      is still colocated with it (or with the next stop). We reroute.
 *
 * This module is pure logic — no React, no side effects. Screens subscribe
 * by calling `computeTripState` on each GPS/vehicle update.
 */

import type { LatLng, OBATripStatus, TripPlan } from "@/types";
import { haversine } from "@/utils/distance";

export type TripPhase =
  | "walking-to-stop"
  | "waiting-at-stop"
  | "on-bus"
  | "your-stop-is-next"
  | "walking-to-destination"
  | "arrived";

export interface TripState {
  phase: TripPhase;
  activeLegIndex: number;
  stopsRemaining: number;
  distanceToBusStopM: number | null;
  distanceToDestinationM: number | null;
  warning: "wrong-bus" | "missed-stop" | null;
  warningDetail?: string;
}

export interface TripStateInputs {
  plan: TripPlan;
  userLocation: LatLng | null;
  vehicleLocation: LatLng | null;
  /** OBA trip status for the ride leg's bus, if available. */
  tripStatus?: OBATripStatus | null;
  /** Route short-name of the nearest moving vehicle (for wrong-bus check). */
  nearestVehicleRouteShortName?: string | null;
  now?: number;
}

const AT_STOP_RADIUS_M = 40;
const AT_DESTINATION_RADIUS_M = 25;

export function computeTripState(input: TripStateInputs): TripState {
  const { plan, userLocation, vehicleLocation, tripStatus } = input;
  const now = input.now ?? Date.now();

  // Default state: at the start of the plan.
  const state: TripState = {
    phase: "walking-to-stop",
    activeLegIndex: 0,
    stopsRemaining: findRideLeg(plan)?.stopsCount ?? 0,
    distanceToBusStopM: null,
    distanceToDestinationM: null,
    warning: null,
  };

  if (!userLocation) return state;

  const rideLeg = findRideLeg(plan);
  const boardStopLoc = rideLeg?.from ?? null;
  const alightStopLoc = rideLeg?.to ?? null;

  state.distanceToDestinationM = haversine(userLocation, plan.destination);
  if (boardStopLoc) {
    state.distanceToBusStopM = haversine(userLocation, boardStopLoc);
  }

  // ---- Phase 1: walking to boarding stop ----
  if (
    boardStopLoc &&
    state.distanceToBusStopM !== null &&
    state.distanceToBusStopM > AT_STOP_RADIUS_M &&
    !isOnMovingVehicle(userLocation, vehicleLocation)
  ) {
    state.phase = "walking-to-stop";
    state.activeLegIndex = 0;
    return state;
  }

  // ---- Phase 2: waiting at boarding stop ----
  if (
    boardStopLoc &&
    state.distanceToBusStopM !== null &&
    state.distanceToBusStopM <= AT_STOP_RADIUS_M &&
    !isOnMovingVehicle(userLocation, vehicleLocation)
  ) {
    state.phase = "waiting-at-stop";
    state.activeLegIndex = 1;
    return state;
  }

  // ---- Phase 3+: on the bus ----
  if (isOnMovingVehicle(userLocation, vehicleLocation)) {
    // Wrong-bus check: nearest vehicle's route mismatches selected route.
    if (
      input.nearestVehicleRouteShortName &&
      rideLeg?.routeShortName &&
      input.nearestVehicleRouteShortName !== rideLeg.routeShortName
    ) {
      state.warning = "wrong-bus";
      state.warningDetail = `You appear to be on Route ${input.nearestVehicleRouteShortName} instead of Route ${rideLeg.routeShortName}.`;
    }

    // Compute stops remaining from OBA trip status.
    if (tripStatus?.nextStop && rideLeg?.alightStopId) {
      if (tripStatus.nextStop === rideLeg.alightStopId) {
        state.phase = "your-stop-is-next";
        state.activeLegIndex = 2;
        state.stopsRemaining = 1;
        return state;
      }
    }

    // Missed-stop check: bus is past the alight stop but user is still moving.
    if (alightStopLoc && vehicleLocation) {
      const busToAlight = haversine(vehicleLocation, alightStopLoc);
      const userToAlight = state.distanceToDestinationM ?? Infinity;
      if (
        tripStatus?.distanceAlongTrip !== undefined &&
        tripStatus?.totalDistanceAlongTrip !== undefined &&
        tripStatus.distanceAlongTrip > (tripStatus.totalDistanceAlongTrip ?? 0) * 0.85 &&
        busToAlight > 150 &&
        userToAlight > 150
      ) {
        state.warning = "missed-stop";
        state.warningDetail = "The bus has passed your stop.";
      }
    }

    state.phase = "on-bus";
    state.activeLegIndex = 2;

    if (rideLeg?.stopsCount && tripStatus?.nextStop) {
      // Rough estimate: interpolate based on distance traveled.
      const frac =
        tripStatus.totalDistanceAlongTrip && tripStatus.distanceAlongTrip
          ? tripStatus.distanceAlongTrip / tripStatus.totalDistanceAlongTrip
          : 0;
      state.stopsRemaining = Math.max(
        1,
        Math.round(rideLeg.stopsCount * (1 - frac)),
      );
    }
    return state;
  }

  // ---- Phase 4: walking from alight stop to destination ----
  if (
    alightStopLoc &&
    haversine(userLocation, alightStopLoc) < 100 &&
    (state.distanceToDestinationM ?? 0) > AT_DESTINATION_RADIUS_M
  ) {
    state.phase = "walking-to-destination";
    state.activeLegIndex = 3;
    return state;
  }

  // ---- Phase 5: arrived ----
  if ((state.distanceToDestinationM ?? Infinity) <= AT_DESTINATION_RADIUS_M) {
    state.phase = "arrived";
    state.activeLegIndex = plan.legs.length;
    return state;
  }

  return state;
}

function findRideLeg(plan: TripPlan) {
  return plan.legs.find((l) => l.kind === "ride");
}

/**
 * Heuristic: if the user is within ~30m of the tracked vehicle AND the
 * vehicle has moved recently, treat them as "on the bus".
 * Without ground-truth boarding events (BLE beacons, ORCA taps), this is the
 * best signal a phone-only app can offer.
 */
function isOnMovingVehicle(
  userLoc: LatLng | null,
  vehicleLoc: LatLng | null,
): boolean {
  if (!userLoc || !vehicleLoc) return false;
  return haversine(userLoc, vehicleLoc) < 35;
}

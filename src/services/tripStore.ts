/**
 * Minimal external store for the "active trip plan".
 *
 * expo-router URL params are strings only, so passing a full TripPlan through
 * them would mean base64-encoding a JSON blob. Instead, we hold the currently
 * selected plan in-memory here, keyed by a short id that DOES fit in a URL.
 *
 * If the process is killed, the trip resets — that's fine for a hackathon
 * demo and consistent with most transit apps (Citymapper does the same).
 */

import { useSyncExternalStore } from "react";
import type { TripPlan } from "@/types";

type Listener = () => void;

let activePlan: TripPlan | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function setActiveTrip(plan: TripPlan | null) {
  activePlan = plan;
  emit();
}

export function getActiveTrip(): TripPlan | null {
  return activePlan;
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useActiveTrip(): TripPlan | null {
  return useSyncExternalStore(subscribe, getActiveTrip, getActiveTrip);
}

/**
 * On Board session store.
 *
 * When the rider says "I'm on Route X, get me off at Stop Y," we persist
 * the pairing here. The On Board screen watches GPS + OBA trip status and
 * fires notifications as the alight stop approaches.
 */

import { useSyncExternalStore } from "react";
import type { OBAStop } from "@/types";

export interface OnBoardSession {
  startedAt: number;
  routeId: string;
  routeShortName: string;
  tripId?: string; // may not be known until we match arrivals
  boardStop?: OBAStop;
  alightStop: OBAStop;
}

type Listener = () => void;

let session: OnBoardSession | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function startOnBoardSession(s: OnBoardSession) {
  session = s;
  emit();
}

export function clearOnBoardSession() {
  session = null;
  emit();
}

export function getOnBoardSession() {
  return session;
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useOnBoardSession(): OnBoardSession | null {
  return useSyncExternalStore(subscribe, getOnBoardSession, getOnBoardSession);
}

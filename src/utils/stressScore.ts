/**
 * Stress-Free Score.
 *
 * We rank trips on how *low-anxiety* they feel to a first-time rider — not
 * how fast they are. The result is a 0–100 score, a 1–5 star display, and a
 * one-line human explanation.
 *
 * Weights (higher = worse for rider):
 *   - Transfers: dominant. Each transfer adds real cognitive load.
 *   - Walking:   >600m starts to hurt in bad weather / with luggage.
 *   - Waiting:   long waits mean uncertainty and missed-bus risk.
 *   - Delays:    known schedule deviation from OBA.
 *   - Duration:  travel time (secondary — this isn't a "fastest" score).
 */

import type { TripPlan } from "@/types";

const WEIGHTS = {
  transfer: 15, // per transfer
  walkPer100m: 2,
  waitPer5min: 4,
  delayPer5min: 6,
  durationPer10min: 2,
} as const;

export interface StressResult {
  score: number; // 0-100 (100 = perfectly calm)
  stars: number; // 1-5
  label: string; // "Stress-Free", "Easy", "Moderate", "Complex"
  reason: string; // short human-readable explanation
}

export interface StressInputs {
  transferCount: number;
  walkingMeters: number;
  waitingSec: number;
  delaySec: number;
  totalDurationSec: number;
}

export function computeStressScore(input: StressInputs): StressResult {
  const transferPenalty = input.transferCount * WEIGHTS.transfer;
  const walkPenalty = (input.walkingMeters / 100) * WEIGHTS.walkPer100m;
  const waitPenalty = (Math.max(0, input.waitingSec) / 300) * WEIGHTS.waitPer5min;
  const delayPenalty = (Math.max(0, input.delaySec) / 300) * WEIGHTS.delayPer5min;
  const durationPenalty =
    (input.totalDurationSec / 600) * WEIGHTS.durationPer10min;

  const rawPenalty =
    transferPenalty + walkPenalty + waitPenalty + delayPenalty + durationPenalty;

  const score = Math.max(0, Math.min(100, Math.round(100 - rawPenalty)));
  const stars = Math.max(1, Math.min(5, Math.round(score / 20)));

  const label =
    score >= 85
      ? "Stress-Free"
      : score >= 65
        ? "Easy"
        : score >= 45
          ? "Moderate"
          : "Complex";

  return { score, stars, label, reason: buildReason(input) };
}

function buildReason(input: StressInputs): string {
  const parts: string[] = [];

  if (input.transferCount === 0) parts.push("No transfers");
  else if (input.transferCount === 1) parts.push("Only one transfer");
  else parts.push(`${input.transferCount} transfers`);

  if (input.walkingMeters < 200) parts.push("very little walking");
  else if (input.walkingMeters < 600) parts.push("short walk");
  else parts.push(`${Math.round(input.walkingMeters)}m of walking`);

  if (input.delaySec > 300) parts.push("bus is running late");

  return parts.join(", ") + ".";
}

/**
 * Given a set of candidate plans, tag each with any of these badges it earns:
 *   - "stress-free" — highest stress score
 *   - "fastest"     — lowest total duration
 *   - "least-walking" — lowest walking distance
 */
export function tagPlans(plans: TripPlan[]): TripPlan[] {
  if (plans.length === 0) return plans;
  const bestStress = plans.reduce((a, b) => (b.stressScore > a.stressScore ? b : a));
  const fastest = plans.reduce((a, b) =>
    b.totalDurationSec < a.totalDurationSec ? b : a,
  );
  const leastWalking = plans.reduce((a, b) =>
    b.totalWalkingMeters < a.totalWalkingMeters ? b : a,
  );

  return plans.map((p) => {
    const tags: TripPlan["tags"] = [];
    if (p === bestStress) tags.push("stress-free");
    if (p === fastest) tags.push("fastest");
    if (p === leastWalking) tags.push("least-walking");
    return { ...p, tags };
  });
}

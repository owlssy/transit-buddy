/**
 * Confidence Indicator.
 *
 * Given the state of a trip (real-time predictions, transfer buffer, delay),
 * produce a high/medium/low badge and one-line "why".
 */

import type { Confidence } from "@/types";

export interface ConfidenceInputs {
  /** Does the arrival for the boarding leg have real-time GPS prediction? */
  hasRealtimeArrival: boolean;
  /** OBA schedule deviation for the trip we're boarding (sec). Positive = late. */
  scheduleDeviationSec: number;
  /** Number of transfers on the plan. */
  transferCount: number;
  /** Minimum wait between transfers, in seconds (undefined = no transfers). */
  minTransferBufferSec?: number;
  /** How stale is the vehicle's last GPS ping (sec)? */
  vehicleUpdateAgeSec?: number;
}

export function computeConfidence(input: ConfidenceInputs): Confidence {
  let score = 100;
  const reasons: string[] = [];

  if (!input.hasRealtimeArrival) {
    score -= 25;
    reasons.push("Scheduled prediction only");
  }

  const absDelay = Math.abs(input.scheduleDeviationSec);
  if (absDelay > 600) {
    score -= 25;
    reasons.push("Bus is running more than 10 min off schedule");
  } else if (absDelay > 240) {
    score -= 12;
    reasons.push("Bus is running a few minutes off schedule");
  }

  if (input.transferCount > 0 && input.minTransferBufferSec !== undefined) {
    if (input.minTransferBufferSec < 180) {
      score -= 20;
      reasons.push("Tight transfer");
    } else if (input.minTransferBufferSec < 360) {
      score -= 8;
      reasons.push("Moderate transfer window");
    }
  }

  if (input.vehicleUpdateAgeSec !== undefined && input.vehicleUpdateAgeSec > 120) {
    score -= 10;
    reasons.push("Bus GPS ping is stale");
  }

  score = Math.max(0, Math.min(100, score));
  const level: Confidence["level"] =
    score >= 75 ? "high" : score >= 45 ? "medium" : "low";

  if (reasons.length === 0) reasons.push("Real-time data looks solid");

  return { score, level, reasons };
}

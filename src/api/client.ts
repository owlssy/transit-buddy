/**
 * Thin fetch wrapper for the OneBusAway REST API.
 *
 * OBA responses are wrapped in an envelope:
 *   { code, currentTime, text, version, data: { entry|list, references } }
 *
 * We unwrap the envelope here so callers get clean payloads and a normalized
 * `references` object (used to resolve stop/route/trip IDs to full objects).
 */

import { ONEBUSAWAY_API_KEY, ONEBUSAWAY_BASE_URL } from "./config";
import type { OBAReferences } from "@/types";

export type OBAResponse<T> = {
  code: number;
  currentTime: number;
  text: string;
  version: number;
  data: T;
};

export type OBAEntryPayload<T> = {
  entry: T;
  references: OBAReferences;
};

export type OBAListPayload<T> = {
  list: T[];
  references: OBAReferences;
  outOfRange?: boolean;
  limitExceeded?: boolean;
};

export class OBAError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly url: string;
  constructor(message: string, status: number, url: string, code?: number) {
    super(message);
    this.name = "OBAError";
    this.status = status;
    this.code = code;
    this.url = url;
  }
}

type QueryValue = string | number | boolean | undefined | null;

function buildQuery(params: Record<string, QueryValue> | undefined): string {
  // Always append the API key. OBA uses `key` (not `apiKey`).
  const pairs: string[] = [`key=${encodeURIComponent(ONEBUSAWAY_API_KEY)}`];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return pairs.join("&");
}

/**
 * Low-level request. Prefer the typed helpers in `oneBusAway.ts`.
 * `path` should start with `/` (e.g. "/api/where/stop/1_29260.json").
 */
export async function obaRequest<T>(
  path: string,
  params?: Record<string, QueryValue>,
  init?: RequestInit,
): Promise<T> {
  const url = `${ONEBUSAWAY_BASE_URL}${path}?${buildQuery(params)}`;

  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    // Try to surface OBA's textual error if present.
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      // ignore
    }
    throw new OBAError(
      `OneBusAway request failed (${res.status}): ${bodyText || res.statusText}`,
      res.status,
      url,
    );
  }

  const json = (await res.json()) as OBAResponse<T>;
  if (json.code && json.code >= 400) {
    throw new OBAError(json.text || "OBA API error", json.code, url, json.code);
  }
  return json.data;
}

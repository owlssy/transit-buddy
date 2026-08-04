import { useQuery } from "@tanstack/react-query";
import { searchStops } from "@/api/oneBusAway";
import type { LatLng, OBAStop } from "@/types";

/**
 * Destination search.
 *
 * Special-cases a numeric-only query (a stop code like "75403" — the number
 * printed on every physical OBA stop sign) by calling `searchStops` with the
 * code as the `query` param, which OBA matches exactly. Otherwise falls back
 * to a text search near the user's current location.
 *
 * If your OBA server exposes a dedicated place-search endpoint you can swap
 * it in here without changes elsewhere in the app.
 */
export function useStopSearch(query: string, near: LatLng | null) {
  const trimmed = query.trim();
  const isStopCode = /^\d{3,6}$/.test(trimmed);

  return useQuery({
    queryKey: [
      "stop-search",
      trimmed,
      isStopCode,
      near?.latitude,
      near?.longitude,
    ],
    // If it's a stop code we don't need `near` — search a big area anywhere.
    enabled: trimmed.length >= 2 && (isStopCode || !!near),
    staleTime: 60_000,
    queryFn: async () => {
      const anchor: LatLng = near ?? { latitude: 47.6062, longitude: -122.3321 }; // fallback: downtown Seattle
      const res = await searchStops(trimmed, anchor);
      // When user typed a code, filter results to exact match — OBA's `query`
      // parameter does a fuzzy match, so we tighten it here.
      if (isStopCode) {
        const exact = res.list.filter((s: OBAStop) => s.code === trimmed);
        if (exact.length > 0) return { ...res, list: exact };
      }
      return res;
    },
  });
}

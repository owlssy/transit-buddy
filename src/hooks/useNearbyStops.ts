import { useQuery } from "@tanstack/react-query";
import { getNearbyStops } from "@/api/oneBusAway";
import type { LatLng } from "@/types";

/**
 * Nearby stops with automatic radius expansion.
 *
 * OBA caps `radius` at ~800m server-side on some deployments, so we start
 * at a suburban-friendly 800m and expand progressively if we come up empty
 * — Bellevue / Redmond stops are much sparser than downtown Seattle.
 */
export function useNearbyStops(location: LatLng | null) {
  return useQuery({
    queryKey: ["nearby-stops", location?.latitude, location?.longitude],
    enabled: !!location,
    staleTime: 30_000,
    queryFn: async () => {
      // Suburbs like Sammamish/Issaquah can require 5–8km to hit any stop,
      // while downtown Seattle saturates at 400m — progressive expansion
      // gets the right density in both cases.
      for (const radius of [800, 2000, 5000, 8000]) {
        const res = await getNearbyStops(location!, { radius, maxCount: 25 });
        if (res.list.length > 0) return res;
      }
      return getNearbyStops(location!, { radius: 8000, maxCount: 25 });
    },
  });
}

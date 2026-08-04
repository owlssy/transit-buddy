import { useQuery } from "@tanstack/react-query";
import { getArrivals } from "@/api/oneBusAway";

/**
 * Arrivals refresh every 15s — matches OneBusAway's typical GTFS-RT update
 * cadence. Longer intervals feel dead; shorter wastes API calls.
 */
export function useArrivals(stopId: string | null | undefined) {
  return useQuery({
    queryKey: ["arrivals", stopId],
    queryFn: () => getArrivals(stopId!),
    enabled: !!stopId,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

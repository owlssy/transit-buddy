import { useQuery } from "@tanstack/react-query";
import { getNearbyStops } from "@/api/oneBusAway";
import { planTrips } from "@/utils/planner";
import type { LatLng, TripPlan } from "@/types";

export interface UseTripPlansArgs {
  origin: LatLng | null;
  destination: LatLng | null;
  destinationName: string;
}

export function useTripPlans({ origin, destination, destinationName }: UseTripPlansArgs) {
  return useQuery<TripPlan[]>({
    queryKey: [
      "trip-plans",
      origin?.latitude,
      origin?.longitude,
      destination?.latitude,
      destination?.longitude,
    ],
    enabled: !!origin && !!destination,
    staleTime: 60_000,
    queryFn: async () => {
      // 1. Get candidate boarding stops near the origin.
      const nearby = await getNearbyStops(origin!, { radius: 600, maxCount: 8 });
      // 2. Plan single-transit-leg trips from those.
      return planTrips({
        origin: origin!,
        destination: destination!,
        destinationName,
        originStops: nearby.list,
      });
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { getTripDetails, getVehiclePosition } from "@/api/oneBusAway";

/** Poll a vehicle's live position while the user is on it. */
export function useVehiclePosition(vehicleId: string | null | undefined) {
  return useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => getVehiclePosition(vehicleId!),
    enabled: !!vehicleId,
    refetchInterval: 10_000,
  });
}

/**
 * Trip details provide `status.position` (bus location) even without a
 * separate vehicleId — useful when the arrival prediction hasn't attached a
 * vehicle yet.
 */
export function useTripDetails(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => getTripDetails(tripId!),
    enabled: !!tripId,
    refetchInterval: 10_000,
  });
}

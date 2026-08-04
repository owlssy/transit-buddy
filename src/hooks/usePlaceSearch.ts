import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";

export interface GeocodedPlace {
  latitude: number;
  longitude: number;
}

/**
 * Freeform landmark/address search. `useStopSearch` only matches OBA stop
 * names, so typing "Space Needle" or "123 Main St" finds nothing there —
 * this hook forward-geocodes the same query so the search bar can also
 * offer a "Go to <query>" destination result, same as tapping a
 * QuickDestinations tile.
 */
export function usePlaceSearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["place-search", trimmed],
    enabled: trimmed.length >= 3,
    staleTime: 60_000,
    queryFn: async (): Promise<GeocodedPlace | null> => {
      try {
        const results = await Location.geocodeAsync(trimmed);
        const first = results[0];
        return first ? { latitude: first.latitude, longitude: first.longitude } : null;
      } catch {
        return null;
      }
    },
  });
}

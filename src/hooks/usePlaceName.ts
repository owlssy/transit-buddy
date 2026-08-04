import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import type { LatLng } from "@/types";

/**
 * Reverse-geocode a lat/lon into a human-readable place name.
 *
 * `expo-location`'s `reverseGeocodeAsync` uses the OS geocoder (Apple / Google),
 * so results are high-quality without needing a separate API key.
 * We produce a compact "Neighborhood, City" style label for headers.
 */
export function usePlaceName(location: LatLng | null) {
  return useQuery({
    queryKey: ["place-name", location?.latitude, location?.longitude],
    enabled: !!location,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string> => {
      const results = await Location.reverseGeocodeAsync(location!);
      const r = results[0];
      if (!r) return "Your location";
      // Compact: prefer district/neighborhood, then city, then region.
      const primary = r.district || r.subregion || r.city || "Nearby";
      const secondary = r.city && r.city !== primary ? r.city : r.region;
      return secondary ? `${primary}, ${secondary}` : primary;
    },
  });
}

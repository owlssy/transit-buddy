/**
 * Foreground location hook.
 *
 * - Requests permission on mount.
 * - Provides `coords`, `status`, and an `error` object.
 * - Subscribes to updates (Balanced accuracy — good enough for stop matching).
 */

import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/types";

export type LocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "error";

export interface UseLocationResult {
  coords: LatLng | null;
  status: LocationStatus;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLocation(): UseLocationResult {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  const start = async () => {
    setStatus("requesting");
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== "granted") {
        setStatus("denied");
        setError("Location permission denied.");
        return;
      }
      setStatus("granted");
      setError(null);

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      // Continuous updates for trip-in-progress screens.
      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (pos) => {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
      );
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    start();
    return () => {
      subRef.current?.remove();
      subRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { coords, status, error, refresh: start };
}

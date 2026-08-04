/**
 * Map tab — full-screen live map of nearby transit.
 *
 * Shows:
 *   • User's current location (blue dot)
 *   • Every nearby stop as a colored pin (color derived from primary route)
 *   • A bottom sheet-style card with the closest stop preview
 *   • Tap any pin → full stop detail (arrivals)
 *
 * This is the visual counterpart to the Home list — riders who think spatially
 * ("what's *near* me") get a map, riders who think functionally ("where do I
 * want to go") get the Home search.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteChip } from "@/components/ui/RouteChip";
import { Card } from "@/components/ui/Card";
import { useLocation } from "@/hooks/useLocation";
import { useNearbyStops } from "@/hooks/useNearbyStops";
import { usePlaceName } from "@/hooks/usePlaceName";
import type { OBAStop } from "@/types";
import { formatDistance, haversine } from "@/utils/distance";

export default function MapTab() {
  const router = useRouter();
  const { coords, status } = useLocation();
  const nearbyQ = useNearbyStops(coords);
  const placeQ = usePlaceName(coords);
  const mapRef = useRef<MapView>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stops: OBAStop[] = nearbyQ.data?.list ?? [];
  const routesById = useMemo(() => {
    const m: Record<string, any> = {};
    for (const r of nearbyQ.data?.references.routes ?? []) m[r.id] = r;
    return m;
  }, [nearbyQ.data]);

  // Auto-fit region to include user + all nearby stops on first load.
  const initialRegion: Region | undefined = useMemo(() => {
    if (!coords) return undefined;
    if (stops.length === 0) {
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    const lats = [coords.latitude, ...stops.map((s) => s.lat)];
    const lons = [coords.longitude, ...stops.map((s) => s.lon)];
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.5),
      longitudeDelta: Math.max(0.02, (maxLon - minLon) * 1.5),
    };
  }, [coords, stops]);

  // When stops arrive later, animate to fit.
  useEffect(() => {
    if (mapRef.current && initialRegion) {
      mapRef.current.animateToRegion(initialRegion, 800);
    }
  }, [initialRegion]);

  const selected = stops.find((s) => s.id === selectedId) ?? stops[0];

  return (
    <View style={{ flex: 1 }} className="bg-surface-soft dark:bg-surface-dark">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {stops.map((stop) => {
          const primaryRouteId = stop.routeIds?.[0];
          const primaryRoute = primaryRouteId ? routesById[primaryRouteId] : null;
          const color = primaryRoute?.color ? `#${primaryRoute.color}` : "#1a9d7a";
          return (
            <Marker
              key={stop.id}
              coordinate={{ latitude: stop.lat, longitude: stop.lon }}
              onPress={() => setSelectedId(stop.id)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                className="items-center justify-center rounded-full border-2 border-white"
                style={{
                  backgroundColor: color,
                  width: selectedId === stop.id ? 34 : 26,
                  height: selectedId === stop.id ? 34 : 26,
                  shadowColor: "#000",
                  shadowOpacity: 0.25,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }}
              >
                <Ionicons name="bus" size={selectedId === stop.id ? 18 : 14} color="#fff" />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Top overlay: place name + counter */}
      <SafeAreaView className="absolute top-0 left-0 right-0" edges={["top"]}>
        <View className="mx-4 mt-2">
          <View
            className="bg-white/95 dark:bg-surface-card/95 rounded-2xl px-4 py-3 flex-row items-center"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            <Ionicons name="location" size={20} color="#1a9d7a" />
            <View className="flex-1 ml-2 min-w-0">
              <Text
                className="text-sm font-bold text-slate-900 dark:text-white"
                numberOfLines={1}
              >
                {status === "granted" ? placeQ.data ?? "Locating…" : "Location off"}
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {stops.length === 0
                  ? "No stops in view"
                  : `${stops.length} stops within ${formatDistance(
                      Math.max(
                        ...stops.map((s) =>
                          coords
                            ? haversine(coords, { latitude: s.lat, longitude: s.lon })
                            : 0,
                        ),
                      ),
                    )}`}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                mapRef.current && coords
                  ? mapRef.current.animateToRegion(
                      {
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      },
                      500,
                    )
                  : null
              }
              className="w-9 h-9 rounded-full bg-brand-600 items-center justify-center"
              hitSlop={8}
            >
              <Ionicons name="locate" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom sheet: selected stop preview */}
      {selected ? (
        <View className="absolute left-0 right-0 bottom-0" pointerEvents="box-none">
          <SafeAreaView edges={["bottom"]}>
            <Pressable
              onPress={() => router.push(`/stop/${encodeURIComponent(selected.id)}`)}
              className="mx-4 mb-3"
            >
              <Card className="p-4">
                <View className="flex-row items-center">
                  <View className="w-11 h-11 rounded-2xl bg-brand-100 dark:bg-brand-900/60 items-center justify-center mr-3">
                    <Ionicons name="bus" size={22} color="#1a9d7a" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text
                      className="text-base font-bold text-slate-900 dark:text-white"
                      numberOfLines={1}
                    >
                      {selected.name}
                    </Text>
                    <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Stop #{selected.code}
                      {coords
                        ? ` · ${formatDistance(haversine(coords, { latitude: selected.lat, longitude: selected.lon }))} away`
                        : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#a3a099" />
                </View>

                {(selected.routeIds?.length ?? 0) > 0 ? (
                  <View className="flex-row flex-wrap gap-1.5 mt-3">
                    {selected.routeIds.slice(0, 6).map((rid) => {
                      const r = routesById[rid];
                      return (
                        <RouteChip
                          key={rid}
                          shortName={r?.shortName ?? "?"}
                          color={r?.color}
                        />
                      );
                    })}
                    {selected.routeIds.length > 6 ? (
                      <View className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                        <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          +{selected.routeIds.length - 6}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View className="flex-row items-center justify-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <Ionicons name="time-outline" size={14} color="#1a9d7a" />
                  <Text className="text-xs font-semibold text-brand-600 dark:text-brand-300 ml-1">
                    Tap for live arrivals
                  </Text>
                </View>
              </Card>
            </Pressable>
          </SafeAreaView>
        </View>
      ) : null}
    </View>
  );
}

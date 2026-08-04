/**
 * On Board tab — "I'm on a bus, alert me when to get off."
 *
 * Three states:
 *   1. Idle: pick a route serving your current-area stops, then pick an
 *      alight stop from that route's stop list.
 *   2. Tracking: shows the alight stop, live distance to it, and estimated
 *      stops-remaining. Fires notifications as you approach.
 *   3. Approaching (distance <= ~400 m): the whole card turns amber →
 *      "Your stop is next — pull the cord."
 */

import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRouteStops } from "@/api/oneBusAway";
import { RouteChip } from "@/components/ui/RouteChip";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLocation } from "@/hooks/useLocation";
import { useNearbyStops } from "@/hooks/useNearbyStops";
import { useStopSearch } from "@/hooks/useStopSearch";
import { notify, notifCopy } from "@/services/notifications";
import {
  clearOnBoardSession,
  startOnBoardSession,
  useOnBoardSession,
} from "@/services/onBoardStore";
import type { OBARoute, OBAStop } from "@/types";
import { formatDistance, haversine } from "@/utils/distance";

const APPROACH_ALERT_M = 500;
const ARRIVAL_ALERT_M = 120;

export default function OnBoardTab() {
  const session = useOnBoardSession();

  if (session) return <TrackingView />;
  return <PickerView />;
}

// ================= Picker (idle state) =================

/** Small inline search field, styled for the (non-poster) dark-mode-aware screens. */
function MiniSearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View className="flex-row items-center bg-surface-muted dark:bg-surface-card rounded-xl px-3 py-2.5">
      <Ionicons name="search" size={18} color="#726f68" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a3a099"
        className="flex-1 ml-2 text-sm text-slate-900 dark:text-white"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color="#a3a099" />
        </Pressable>
      ) : null}
    </View>
  );
}

function PickerView() {
  const { coords } = useLocation();
  const nearbyQ = useNearbyStops(coords);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const searchQ = useStopSearch(debouncedQuery, coords);
  const isSearching = query.trim().length >= 2;

  const [selectedStop, setSelectedStop] = useState<OBAStop | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<OBARoute | null>(null);

  const routesById = useMemo(() => {
    const map: Record<string, OBARoute> = {};
    for (const r of nearbyQ.data?.references.routes ?? []) map[r.id] = r;
    for (const r of searchQ.data?.references.routes ?? []) map[r.id] = r;
    return map;
  }, [nearbyQ.data, searchQ.data]);

  const closestStops = useMemo(() => {
    if (!coords || !nearbyQ.data?.list) return [];
    return [...nearbyQ.data.list]
      .sort(
        (a, b) =>
          haversine(coords, { latitude: a.lat, longitude: a.lon }) -
          haversine(coords, { latitude: b.lat, longitude: b.lon }),
      )
      .slice(0, 5);
  }, [coords, nearbyQ.data]);

  const routesAtSelectedStop = useMemo(() => {
    if (!selectedStop) return [];
    return (selectedStop.routeIds ?? [])
      .map((id) => routesById[id])
      .filter((r): r is OBARoute => !!r)
      .sort((a, b) => (a.shortName ?? "").localeCompare(b.shortName ?? ""));
  }, [selectedStop, routesById]);

  if (selectedRoute) {
    return (
      <SafeAreaView className="flex-1 bg-surface-soft dark:bg-surface-dark" edges={["top"]}>
        <StopPickerForRoute route={selectedRoute} onCancel={() => setSelectedRoute(null)} />
      </SafeAreaView>
    );
  }

  if (selectedStop) {
    return (
      <SafeAreaView className="flex-1 bg-surface-soft dark:bg-surface-dark" edges={["top"]}>
        <View className="px-4 flex-row items-center mb-2 pt-2">
          <Pressable onPress={() => setSelectedStop(null)} className="mr-2 p-1" hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#100f0d" />
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text
              className="text-sm font-bold text-slate-900 dark:text-white"
              numberOfLines={1}
            >
              {selectedStop.name}
            </Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400">
              Stop #{selectedStop.code}
            </Text>
          </View>
        </View>
        <View className="px-4 mb-1">
          <SectionHeader label="Step 1 · Pick your route" />
        </View>
        {routesAtSelectedStop.length === 0 ? (
          <Card className="items-center py-8 mt-2 mx-4">
            <Ionicons name="bus-outline" size={30} color="#a3a099" />
            <Text className="mt-2 font-bold text-slate-800 dark:text-white">
              No routes found for this stop
            </Text>
          </Card>
        ) : (
          <ScrollView className="px-4">
            <View className="mt-2 gap-2 pb-6">
              {routesAtSelectedStop.map((r) => (
                <Pressable key={r.id} onPress={() => setSelectedRoute(r)}>
                  <Card className="p-3">
                    <View className="flex-row items-center">
                      <RouteChip shortName={r.shortName ?? "?"} color={r.color} large />
                      <View className="flex-1 ml-3 min-w-0">
                        <Text
                          className="text-base font-bold text-slate-900 dark:text-white"
                          numberOfLines={1}
                        >
                          {r.longName || r.description || `Route ${r.shortName}`}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#a3a099" />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  const stopResults = isSearching ? (searchQ.data?.list ?? []) : closestStops;
  const isLoadingStops = isSearching ? searchQ.isLoading : nearbyQ.isLoading;

  return (
    <SafeAreaView className="flex-1 bg-surface-soft dark:bg-surface-dark" edges={["top"]}>
      <View className="px-4 pt-2">
        <View className="flex-row items-center mb-4">
          <View className="w-10 h-10 rounded-2xl bg-transit-green items-center justify-center mr-2.5">
            <Ionicons name="bus" size={22} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              On Board
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tell us your bus. We'll tell you when to get off.
            </Text>
          </View>
        </View>

        <MiniSearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a stop further away"
        />
      </View>

      <ScrollView className="px-4 pt-5">
        <SectionHeader
          label={isSearching ? "Step 1 · Search results" : "Step 1 · Closest stops"}
        />
        {isLoadingStops ? (
          <View className="gap-2 mt-2">
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : stopResults.length === 0 ? (
          <Card className="items-center py-8 mt-2">
            <Ionicons name="bus-outline" size={30} color="#a3a099" />
            <Text className="mt-2 font-bold text-slate-800 dark:text-white">
              {isSearching ? "No matching stops" : "No nearby stops"}
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-center px-6">
              {isSearching
                ? "Try a stop code, street name, or landmark."
                : "We couldn't find any transit near your location."}
            </Text>
          </Card>
        ) : (
          <View className="mt-2 gap-2 pb-6">
            {stopResults.map((s) => {
              const d = coords
                ? haversine(coords, { latitude: s.lat, longitude: s.lon })
                : null;
              return (
                <Pressable key={s.id} onPress={() => setSelectedStop(s)}>
                  <Card className="p-3">
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-2xl bg-brand-100 dark:bg-brand-900/60 items-center justify-center mr-3">
                        <Ionicons name="pin" size={18} color="#1a9d7a" />
                      </View>
                      <View className="flex-1 ml-1 min-w-0">
                        <Text
                          className="text-base font-bold text-slate-900 dark:text-white"
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                        <Text className="text-xs text-slate-500 dark:text-slate-400">
                          Stop #{s.code}
                          {d !== null ? ` · ${formatDistance(d)} away` : ""}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#a3a099" />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StopPickerForRoute({
  route,
  onCancel,
}: {
  route: OBARoute;
  onCancel: () => void;
}) {
  const { coords } = useLocation();
  const [query, setQuery] = useState("");
  const routeStopsQ = useQuery({
    queryKey: ["route-stops", route.id],
    queryFn: () => getRouteStops(route.id),
    staleTime: 5 * 60_000,
  });

  const stops: OBAStop[] = useMemo(() => {
    const refs = routeStopsQ.data?.references.stops ?? [];
    const ids = routeStopsQ.data?.entry.stopIds ?? [];
    const byId = new Map(refs.map((s) => [s.id, s]));
    const ordered = ids.map((id) => byId.get(id)).filter((s): s is OBAStop => !!s);
    // Sorted by distance from the rider, not OBA's route-direction order —
    // the alight stop you want is almost always "closest ahead", and a
    // distance sort makes that easy to scan regardless of which direction
    // OBA happened to list the route in.
    if (!coords) return ordered;
    return [...ordered].sort(
      (a, b) =>
        haversine(coords, { latitude: a.lat, longitude: a.lon }) -
        haversine(coords, { latitude: b.lat, longitude: b.lon }),
    );
  }, [routeStopsQ.data, coords]);

  const filteredStops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stops;
    return stops.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [stops, query]);

  return (
    <View className="flex-1">
      <View className="px-4 flex-row items-center mb-2">
        <Pressable onPress={onCancel} className="mr-2 p-1" hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#100f0d" />
        </Pressable>
        <RouteChip shortName={route.shortName ?? "?"} color={route.color} />
        <Text
          className="flex-1 ml-2 text-sm font-bold text-slate-800 dark:text-white"
          numberOfLines={1}
        >
          {route.longName || route.description || `Route ${route.shortName}`}
        </Text>
      </View>
      <View className="px-4 mb-4">
        <MiniSearchBar value={query} onChangeText={setQuery} placeholder="Search for a stop" />
      </View>
      <View className="px-4 mb-1">
        <SectionHeader label="Step 2 · Which stop do you want to get off at?" />
      </View>
      {routeStopsQ.isLoading ? (
        <View className="px-4 gap-2 mt-2">
          <Skeleton height={50} />
          <Skeleton height={50} />
          <Skeleton height={50} />
        </View>
      ) : filteredStops.length === 0 ? (
        <Card className="items-center py-8 mt-2 mx-4">
          <Ionicons name="search" size={28} color="#a3a099" />
          <Text className="mt-2 font-bold text-slate-800 dark:text-white">
            No matching stops
          </Text>
        </Card>
      ) : (
        <FlatList
          className="px-4"
          data={filteredStops}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => {
            const d = coords
              ? haversine(coords, { latitude: item.lat, longitude: item.lon })
              : null;
            return (
              <Pressable
                onPress={() =>
                  startOnBoardSession({
                    startedAt: Date.now(),
                    routeId: route.id,
                    routeShortName: route.shortName ?? "?",
                    alightStop: item,
                  })
                }
                className="py-3 px-3 flex-row items-center border-b border-slate-100 dark:border-slate-800"
              >
                <View className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center mr-3">
                  <Ionicons name="pin" size={16} color="#4a4844" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    Stop #{item.code}
                    {d !== null ? ` · ${formatDistance(d)} away` : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#a3a099" />
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

// ================= Tracking (active session) =================

function TrackingView() {
  const session = useOnBoardSession()!;
  const { coords } = useLocation();

  const distanceM =
    coords &&
    haversine(coords, {
      latitude: session.alightStop.lat,
      longitude: session.alightStop.lon,
    });

  // Notification cadence: approaching (~500m), arriving (~120m), then done.
  const alertedRef = useRef<{ approaching: boolean; arriving: boolean }>({
    approaching: false,
    arriving: false,
  });

  useEffect(() => {
    if (distanceM === null) return;
    if (distanceM <= ARRIVAL_ALERT_M && !alertedRef.current.arriving) {
      alertedRef.current.arriving = true;
      notify(notifCopy.exitNow(session.alightStop.name));
    } else if (distanceM <= APPROACH_ALERT_M && !alertedRef.current.approaching) {
      alertedRef.current.approaching = true;
      notify(notifCopy.yourStopIsNext());
    }
  }, [distanceM, session.alightStop.name]);

  const isApproaching =
    distanceM !== null && distanceM !== undefined && distanceM <= APPROACH_ALERT_M;
  const isArriving =
    distanceM !== null && distanceM !== undefined && distanceM <= ARRIVAL_ALERT_M;

  return (
    <SafeAreaView className="flex-1 bg-surface-soft dark:bg-surface-dark" edges={["top"]}>
      <ScrollView className="px-4 pt-2">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-2xl bg-transit-green items-center justify-center mr-2.5">
              <Ionicons name="bus" size={22} color="#fff" />
            </View>
            <View>
              <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
                On Board
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                Route {session.routeShortName} · tracking
              </Text>
            </View>
          </View>
          <Pressable
            onPress={clearOnBoardSession}
            className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl"
          >
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">
              End
            </Text>
          </Pressable>
        </View>

        {/* Hero card — colored by proximity */}
        <Card
          className={`p-6 mb-4 ${
            isArriving
              ? "bg-red-50 dark:bg-red-900/40"
              : isApproaching
                ? "bg-amber-50 dark:bg-amber-900/40"
                : "bg-brand-50 dark:bg-brand-900/40"
          }`}
        >
          <View className="flex-row items-center mb-2">
            <Ionicons
              name={
                isArriving
                  ? "notifications"
                  : isApproaching
                    ? "warning"
                    : "navigate"
              }
              size={20}
              color={isArriving ? "#b83d2f" : isApproaching ? "#a86f00" : "#1a9d7a"}
            />
            <Text
              className="text-xs uppercase font-bold tracking-widest ml-2"
              style={{
                color: isArriving ? "#b83d2f" : isApproaching ? "#a86f00" : "#1a9d7a",
              }}
            >
              {isArriving
                ? "Exit here"
                : isApproaching
                  ? "Your stop is next"
                  : "Getting off at"}
            </Text>
          </View>
          <Text className="text-3xl font-extrabold text-slate-900 leading-tight">
            {session.alightStop.name}
          </Text>
          <Text className="text-sm text-slate-700 mt-2">
            Stop #{session.alightStop.code}
            {session.alightStop.direction
              ? ` · heading ${session.alightStop.direction}`
              : ""}
          </Text>
        </Card>

        {/* Distance readout */}
        <Card className="mb-4">
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest">
                Distance to stop
              </Text>
              <Text className="text-4xl font-extrabold text-slate-900 dark:text-white mt-1">
                {distanceM !== null && distanceM !== undefined
                  ? formatDistance(distanceM)
                  : "—"}
              </Text>
            </View>
            <View className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center">
              <Ionicons
                name={isArriving ? "flag" : "walk"}
                size={26}
                color={isArriving ? "#b83d2f" : "#4a4844"}
              />
            </View>
          </View>
        </Card>

        {/* Alerts config */}
        <Card>
          <Text className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest mb-2">
            You'll be notified
          </Text>
          <AlertRow
            done={
              (distanceM ?? Infinity) <= APPROACH_ALERT_M ||
              alertedRef.current.approaching
            }
            label={`When you're within ${formatDistance(APPROACH_ALERT_M)}`}
            sub="Get ready to signal the driver"
          />
          <AlertRow
            done={
              (distanceM ?? Infinity) <= ARRIVAL_ALERT_M ||
              alertedRef.current.arriving
            }
            label={`When you're within ${formatDistance(ARRIVAL_ALERT_M)}`}
            sub="Exit here"
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function AlertRow({
  done,
  label,
  sub,
}: {
  done: boolean;
  label: string;
  sub: string;
}) {
  return (
    <View className="flex-row items-center py-2">
      <View
        className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
          done ? "bg-transit-green" : "bg-slate-200 dark:bg-slate-700"
        }`}
      >
        {done ? (
          <Ionicons name="checkmark" size={14} color="#fff" />
        ) : (
          <View className="w-2 h-2 rounded-full bg-slate-400" />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900 dark:text-white">
          {label}
        </Text>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</Text>
      </View>
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest">
      {label}
    </Text>
  );
}

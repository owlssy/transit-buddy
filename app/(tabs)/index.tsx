/**
 * Home screen — TransitBuddy's front door.
 *
 * Composition (top → bottom):
 *   • Brand strip + subtle status
 *   • Big destination search
 *   • Horizontal quick-destination tiles (PNW landmarks)
 *   • Current-location card
 *   • Recent destinations (if any)
 *   • Nearby stops (with live route pills)
 *
 * Every nearby stop card jumps to its live-arrivals screen; every quick
 * destination or search result jumps to Route Results.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IS_API_CONFIGURED } from "@/api/config";
import { QuickDestinations, type QuickPlace } from "@/components/QuickDestinations";
import { SearchBar } from "@/components/SearchBar";
import { StopListItem } from "@/components/StopListItem";
import { TransitLineArt } from "@/components/TransitLineArt";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLocation } from "@/hooks/useLocation";
import { useNearbyStops } from "@/hooks/useNearbyStops";
import { usePlaceName } from "@/hooks/usePlaceName";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { useRecents } from "@/hooks/useRecents";
import { useStopSearch } from "@/hooks/useStopSearch";
import { useSaveUserName, useUserName } from "@/hooks/useUserName";
import type { OBAStop } from "@/types";
import { formatDistance, haversine } from "@/utils/distance";

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { coords, status, refresh } = useLocation();

  const debouncedQuery = useDebouncedValue(query, 350);
  const nearbyQ = useNearbyStops(coords);
  const searchQ = useStopSearch(debouncedQuery, coords);
  const placeSearchQ = usePlaceSearch(debouncedQuery);
  const recentsQ = useRecents();
  const placeNameQ = usePlaceName(coords);

  const userNameQ = useUserName();
  const saveUserName = useSaveUserName();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  // Local override so the greeting updates the instant you tap the
  // checkmark, instead of waiting on the AsyncStorage round-trip through
  // react-query (which was the "nothing happens when I save my name" bug).
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const savedName = nameOverride ?? userNameQ.data ?? null;

  const startEditingName = () => {
    setNameDraft(savedName ?? "");
    setEditingName(true);
  };
  const submitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setEditingName(false);
      return;
    }
    setNameOverride(trimmed);
    setEditingName(false);
    saveUserName(trimmed).catch(() => {});
  };

  // Index routes from the OBA `references` payload so StopListItem can
  // render actual route short-names (e.g. "545") not raw agency-prefixed IDs.
  const routesById = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of nearbyQ.data?.references.routes ?? []) map[r.id] = r;
    for (const r of searchQ.data?.references.routes ?? []) map[r.id] = r;
    return map;
  }, [nearbyQ.data, searchQ.data]);

  const nearbyWithDistance = useMemo(() => {
    if (!coords || !nearbyQ.data?.list) return [];
    return nearbyQ.data.list
      .map((s) => ({
        stop: s,
        distanceM: haversine(coords, { latitude: s.lat, longitude: s.lon }),
      }))
      .sort((a, b) => a.distanceM - b.distanceM);
  }, [coords, nearbyQ.data]);

  const goToStop = (stop: OBAStop) => router.push(`/stop/${encodeURIComponent(stop.id)}`);

  const goToResults = (destination: {
    location: { latitude: number; longitude: number };
    name: string;
  }) => {
    router.push({
      pathname: "/results",
      params: {
        destLat: String(destination.location.latitude),
        destLon: String(destination.location.longitude),
        destName: destination.name,
      },
    });
  };

  const goToQuickPlace = (p: QuickPlace) =>
    goToResults({ location: p.location, name: p.label });

  const goToStopAsDestination = (stop: OBAStop) =>
    goToResults({
      location: { latitude: stop.lat, longitude: stop.lon },
      name: stop.name,
    });

  // ---- HEADER: cream poster hero, matching the pitch-deck brand mark ----
  const Header = (
    <View className="bg-cream pb-6">
      <View className="items-center pt-6">
        {/* Icon row: two subway lines pass behind the badge, vertically
            centered on it (not the whole logo+wordmark block) so the
            "interchange station" look lines up correctly. */}
        <View style={{ height: 56, width: "100%" }} className="items-center justify-center">
          <View
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
            pointerEvents="none"
          >
            <TransitLineArt side="duo" width="100%" height={56} />
          </View>
          <View className="w-14 h-14 rounded-full bg-cream items-center justify-center">
            <View className="w-9 h-9 rounded-full bg-navy-600 items-center justify-center">
              <Ionicons name="bus" size={18} color="#f4f1e8" />
            </View>
          </View>
        </View>

        <Text className="text-base font-extrabold text-coffee tracking-tight mt-1">
          TransitBuddy
        </Text>
      </View>

      <View className="px-5 mt-2">
        {editingName || !savedName ? (
          <>
            <Text
              className="text-5xl font-extrabold text-coffee tracking-tight"
              style={{ width: "100%" }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              Where to?
            </Text>
            <View className="flex-row items-center mt-3 mb-5 w-full">
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="What's your name?"
                placeholderTextColor="#2a1c1299"
                className="flex-1 bg-cream border-2 border-coffee/15 rounded-lg px-3 py-2 text-coffee text-[15px]"
                returnKeyType="done"
                onSubmitEditing={submitName}
                autoCapitalize="words"
              />
              <Pressable
                onPress={submitName}
                className="ml-2 bg-coffee w-10 h-10 rounded-lg items-center justify-center"
              >
                <Ionicons name="checkmark" size={20} color="#f4f1e8" />
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable onPress={startEditingName} className="mb-5">
            <Text
              className="text-5xl font-extrabold text-coffee tracking-tight"
              style={{ width: "100%" }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              Where to, {savedName}?
            </Text>
          </Pressable>
        )}

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search a stop, code (#75403), or landmark"
          onClear={() => setQuery("")}
          keyboardType="default"
        />

        {!IS_API_CONFIGURED ? (
          <View className="mt-4 border-2 border-coffee/15 rounded-lg p-3 flex-row items-start">
            <Ionicons name="key" size={18} color="#a86f00" />
            <View className="flex-1 ml-2">
              <Text className="text-sm font-semibold text-coffee">
                OneBusAway API key missing
              </Text>
              <Text className="text-xs text-coffee/70 mt-1">
                Add EXPO_PUBLIC_ONEBUSAWAY_API_KEY to your .env then restart Expo.
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );

  // ---- SEARCH MODE ----
  if (query.trim().length >= 2) {
    return (
      <SafeAreaView className="flex-1 bg-sage" edges={["top"]}>
        {Header}
        <View className="px-5 mt-4 flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <SectionHeader label="Search results" />
            <Text className="text-[11px] text-coffee/60">
              Tap for live arrivals · long-press to set as destination
            </Text>
          </View>
          {searchQ.isLoading || placeSearchQ.isLoading || query !== debouncedQuery ? (
            <View className="gap-2 mt-2">
              <Skeleton height={80} />
              <Skeleton height={80} />
              <Skeleton height={80} />
            </View>
          ) : (
            <>
              {placeSearchQ.data ? (
                <Pressable
                  onPress={() =>
                    goToResults({ location: placeSearchQ.data!, name: query.trim() })
                  }
                  className="mt-2"
                >
                  <View className="flex-row items-center bg-cream rounded-lg p-4 border-2 border-coffee/10">
                    <View className="w-11 h-11 rounded-lg bg-sage items-center justify-center mr-3">
                      <Ionicons name="navigate" size={20} color="#2a1c12" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-base font-bold text-coffee" numberOfLines={1}>
                        {query.trim()}
                      </Text>
                      <Text className="text-xs text-coffee/60 mt-0.5">
                        Plan a trip to this address
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#2a1c1299" />
                  </View>
                </Pressable>
              ) : null}

              {(searchQ.data?.list ?? []).length === 0 && !placeSearchQ.data ? (
                <EmptyState
                  icon="search"
                  title="No matches"
                  hint="Try the 5-digit code from a stop sign, a street name, or a landmark."
                />
              ) : (
                <FlatList
                  className="mt-2"
                  data={searchQ.data?.list ?? []}
                  keyExtractor={(s) => s.id}
                  renderItem={({ item }) => (
                    <StopListItem
                      stop={item}
                      routesById={routesById}
                      distanceM={
                        coords
                          ? haversine(coords, { latitude: item.lat, longitude: item.lon })
                          : undefined
                      }
                      onPress={() => goToStop(item)}
                    />
                  )}
                  contentContainerStyle={{ paddingBottom: 24 }}
                />
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ---- DEFAULT HOME ----
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={nearbyQ.isRefetching}
            onRefresh={() => {
              refresh();
              nearbyQ.refetch();
            }}
            tintColor="#2a1c12"
          />
        }
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {Header}

        {/* Sage panel — everything below the hero lives on the poster's
            second color block instead of a floating white/gray canvas.
            flex: 1 (not minHeight) so it always reaches the bottom of the
            screen even when there's little content, instead of leaving the
            cream background exposed underneath. */}
        <View className="bg-sage rounded-t-2xl pt-6" style={{ flex: 1 }}>
          {/* Quick destinations — horizontal row of PNW landmarks */}
          <View>
            <View className="px-5 mb-2">
              <SectionHeader label="Popular in the PNW" />
            </View>
            <QuickDestinations onSelect={goToQuickPlace} />
          </View>

          {/* Current location card */}
          <View className="px-5 mt-5">
            <View className="flex-row items-center bg-cream rounded-lg p-4 border-2 border-coffee/10">
              <View className="w-11 h-11 rounded-lg bg-sage items-center justify-center mr-3">
                <Ionicons name="locate" size={22} color="#2a1c12" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-coffee">
                  {status === "granted"
                    ? placeNameQ.data ?? "You're here"
                    : status === "requesting"
                      ? "Locating…"
                      : status === "denied"
                        ? "Location off"
                        : "Location"}
                </Text>
                <Text className="text-xs text-coffee/60 mt-0.5">
                  {status === "granted"
                    ? placeNameQ.isLoading
                      ? "Naming your location…"
                      : "Refresh to update"
                    : status === "denied"
                      ? "Tap Enable to find nearby stops"
                      : status === "requesting"
                        ? "One moment…"
                        : "Unknown"}
                </Text>
              </View>
              {status !== "granted" ? (
                <Pressable onPress={refresh} className="bg-coffee px-3 py-2 rounded-xl">
                  <Text className="text-cream text-xs font-semibold">Enable</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Recent destinations */}
          {(recentsQ.data?.length ?? 0) > 0 ? (
            <View className="px-5 mt-6">
              <SectionHeader label="Recent" />
              <View className="mt-2 gap-2">
                {recentsQ.data!.slice(0, 3).map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() =>
                      goToResults({ location: r.location, name: r.name })
                    }
                  >
                    <View className="flex-row items-center bg-cream rounded-lg p-4 border-2 border-coffee/10">
                      <View className="w-9 h-9 rounded-full bg-sage items-center justify-center mr-3">
                        <Ionicons name="time-outline" size={18} color="#2a1c12" />
                      </View>
                      <Text
                        className="flex-1 text-coffee font-semibold"
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color="#2a1c1299" />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* Nearby stops */}
          <View className="px-5 mt-6 pb-8">
            <View className="flex-row items-center justify-between mb-2">
              <SectionHeader label="Nearby stops" />
              {nearbyWithDistance.length > 0 ? (
                <Text className="text-[11px] font-bold text-coffee/50">
                  {nearbyWithDistance.length} within{" "}
                  {formatDistance(
                    nearbyWithDistance[nearbyWithDistance.length - 1].distanceM,
                  )}
                </Text>
              ) : null}
            </View>

            {status !== "granted" ? (
              <EmptyState
                icon="locate-outline"
                title="Enable location"
                hint="TransitBuddy needs your GPS to find stops around you."
              />
            ) : nearbyQ.isLoading ? (
              <View className="gap-2">
                <Skeleton height={90} />
                <Skeleton height={90} />
                <Skeleton height={90} />
              </View>
            ) : nearbyQ.isError ? (
              <EmptyState
                icon="cloud-offline"
                title="Couldn't reach OneBusAway"
                hint={
                  nearbyQ.error instanceof Error
                    ? nearbyQ.error.message
                    : "Check your network and API key."
                }
              />
            ) : nearbyWithDistance.length === 0 ? (
              <EmptyState
                icon="bus-outline"
                title="No stops within 3 km"
                hint="You may be outside OneBusAway coverage. Try a landmark above."
              />
            ) : (
              nearbyWithDistance.map(({ stop, distanceM }) => (
                <StopListItem
                  key={stop.id}
                  stop={stop}
                  distanceM={distanceM}
                  routesById={routesById}
                  onPress={() => goToStop(stop)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text className="text-xs uppercase font-bold text-coffee/70 tracking-widest">
      {label}
    </Text>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
}) {
  return (
    <View className="items-center py-8 bg-cream rounded-lg border-2 border-coffee/10">
      <Ionicons name={icon} size={30} color="#2a1c1299" />
      <Text className="mt-2 font-bold text-coffee">{title}</Text>
      <Text className="mt-1 text-xs text-coffee/60 text-center px-6">
        {hint}
      </Text>
    </View>
  );
}

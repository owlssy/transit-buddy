/**
 * Route Results screen.
 *
 * Shows multiple candidate trip plans for the (origin → destination) pair
 * pulled from the URL params. Tapping a plan stores it in the trip store and
 * navigates to the Navigation / Ride Companion screen.
 */

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteOptionCard } from "@/components/RouteOptionCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocation } from "@/hooks/useLocation";
import { useTripPlans } from "@/hooks/useTripPlans";
import { useSaveRecent } from "@/hooks/useRecents";
import { setActiveTrip } from "@/services/tripStore";
import type { TripPlan } from "@/types";
import { formatDistance, haversine } from "@/utils/distance";

export default function ResultsScreen() {
  const router = useRouter();
  const { coords } = useLocation();
  const params = useLocalSearchParams<{
    destLat: string;
    destLon: string;
    destName: string;
  }>();

  const destination = useMemo(() => {
    const lat = Number(params.destLat);
    const lon = Number(params.destLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { latitude: lat, longitude: lon };
  }, [params.destLat, params.destLon]);

  const destName = String(params.destName ?? "Destination");
  const saveRecent = useSaveRecent();

  // Record this destination as a recent as soon as we have both lat/lon.
  useEffect(() => {
    if (!destination) return;
    saveRecent({
      id: `${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`,
      name: destName,
      location: destination,
      visitedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.latitude, destination?.longitude]);

  const plansQ = useTripPlans({
    origin: coords,
    destination,
    destinationName: destName,
  });

  const selectPlan = (plan: TripPlan) => {
    setActiveTrip(plan);
    router.push("/navigate");
  };

  const crowFliesM =
    coords && destination ? haversine(coords, destination) : null;

  return (
    <SafeAreaView className="flex-1 bg-surface-soft dark:bg-surface-dark" edges={["top"]}>
      <ScreenHeader
        title="Ways to get there"
        subtitle={destName}
        onBack={() => router.back()}
      />

      {/* Origin → destination summary */}
      <View className="px-4 mb-3">
        <Card className="py-3">
          <View className="flex-row items-center">
            <View className="items-center mr-3">
              <View className="w-2.5 h-2.5 rounded-full bg-brand-500" />
              <View className="w-0.5 h-5 bg-slate-300 dark:bg-slate-600" />
              <View className="w-2.5 h-2.5 rounded-full bg-transit-green" />
            </View>
            <View className="flex-1 min-w-0">
              <Text
                className="text-sm font-semibold text-slate-900 dark:text-white"
                numberOfLines={1}
              >
                Your location
              </Text>
              <View className="h-2" />
              <Text
                className="text-sm font-semibold text-slate-900 dark:text-white"
                numberOfLines={1}
              >
                {destName}
              </Text>
            </View>
            {crowFliesM ? (
              <View className="items-end ml-3">
                <Text className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  As the crow
                </Text>
                <Text className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {formatDistance(crowFliesM)}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      </View>

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: 24 }}>
        {!coords ? (
          <StatusCard
            icon="locate-outline"
            title="Waiting for your location…"
            hint="We need GPS to plan a trip from where you are."
          />
        ) : plansQ.isLoading ? (
          <View>
            <View className="flex-row items-center mb-3">
              <Ionicons name="sync" size={16} color="#1a9d7a" />
              <Text className="text-xs font-semibold text-brand-600 dark:text-brand-300 ml-2">
                Planning your trip — checking arrivals and transfers…
              </Text>
            </View>
            <View className="gap-3">
              <Skeleton height={180} />
              <Skeleton height={180} />
              <Skeleton height={180} />
            </View>
          </View>
        ) : plansQ.isError ? (
          <StatusCard
            icon="cloud-offline"
            title="Couldn't plan a trip"
            hint={
              plansQ.error instanceof Error
                ? plansQ.error.message
                : "Check your API key and network."
            }
          />
        ) : (plansQ.data ?? []).length === 0 ? (
          <StatusCard
            icon="search-outline"
            title="No routes found"
            hint="Try a closer destination or a different time."
          />
        ) : (
          <>
            <Text className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide mb-2">
              {plansQ.data!.length} option{plansQ.data!.length === 1 ? "" : "s"}
            </Text>
            {plansQ.data!.map((p) => (
              <RouteOptionCard key={p.id} plan={p} onPress={() => selectPlan(p)} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusCard({
  icon,
  title,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
}) {
  return (
    <Card className="items-center py-10">
      <Ionicons name={icon} size={32} color="#a3a099" />
      <Text className="mt-2 font-semibold text-slate-900 dark:text-white">{title}</Text>
      <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-center px-6">
        {hint}
      </Text>
    </Card>
  );
}

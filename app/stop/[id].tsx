/**
 * Stop Detail screen — real-time arrivals for a single stop.
 *
 * Tapping an arrival opens the Ride Companion for that specific trip,
 * treating the stop as both origin and boarding stop and the last-served
 * stop on the route as the destination hint (user can still walk from
 * there). This flow is optimized for "I'm at this stop, catch me on this bus"
 * rather than the full destination-driven journey planner.
 */

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getStop } from "@/api/oneBusAway";
import { RouteChip } from "@/components/ui/RouteChip";
import { Card } from "@/components/ui/Card";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useArrivals } from "@/hooks/useArrivals";
import { computeConfidence } from "@/utils/confidence";
import {
  formatClock,
  formatDeviation,
  formatRelativeMinutes,
} from "@/utils/time";

export default function StopDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const stopId = String(params.id);

  const stopQ = useQuery({
    queryKey: ["stop", stopId],
    queryFn: () => getStop(stopId),
    staleTime: 5 * 60_000,
  });
  const arrivalsQ = useArrivals(stopId);

  const stop = stopQ.data?.entry;
  const arrivals = arrivalsQ.data?.entry.arrivalsAndDepartures ?? [];

  return (
    <SafeAreaView className="flex-1 bg-surface-soft dark:bg-surface-dark" edges={["top"]}>
      <ScreenHeader
        title={stop?.name ?? "Stop"}
        subtitle={stop ? `Stop #${stop.code}${stop.direction ? ` · ${stop.direction}` : ""}` : "Loading…"}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => arrivalsQ.refetch()}
            className="w-10 h-10 rounded-full bg-surface-muted dark:bg-surface-card items-center justify-center"
            hitSlop={10}
          >
            <Ionicons
              name="refresh"
              size={20}
              color="#100f0d"
              style={{ transform: [{ rotate: arrivalsQ.isFetching ? "180deg" : "0deg" }] }}
            />
          </Pressable>
        }
      />

      <ScrollView className="px-4">
        <Text className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide mb-2">
          Live arrivals · refreshes every 15s
        </Text>

        {arrivalsQ.isLoading ? (
          <View className="gap-2">
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={80} />
          </View>
        ) : arrivals.length === 0 ? (
          <Card className="items-center py-8">
            <Ionicons name="hourglass-outline" size={28} color="#a3a099" />
            <Text className="mt-2 font-semibold text-slate-800 dark:text-white">
              No arrivals in the next hour
            </Text>
          </Card>
        ) : (
          arrivals.map((a, idx) => {
            const boardTime =
              a.predictedArrivalTime > 0 ? a.predictedArrivalTime : a.scheduledArrivalTime;
            const deviation =
              a.predictedArrivalTime > 0 && a.scheduledArrivalTime > 0
                ? Math.round((a.predictedArrivalTime - a.scheduledArrivalTime) / 1000)
                : 0;
            const conf = computeConfidence({
              hasRealtimeArrival: a.predicted,
              scheduleDeviationSec: deviation,
              transferCount: 0,
            });
            const deviationLabel = formatDeviation(deviation);

            return (
              <Pressable
                // OBA can return multiple arrivals per (trip, stop) pair on
                // frequent-service routes (multiple vehicles serving the same
                // trip block, or repeated across service dates). Include time
                // + index so the key is always unique.
                key={`${a.tripId}-${a.stopSequence}-${a.scheduledArrivalTime}-${idx}`}
                onPress={() =>
                  router.push({
                    pathname: "/results",
                    params: {
                      destLat: String(stop?.lat ?? 0),
                      destLon: String(stop?.lon ?? 0),
                      destName: `Route ${a.routeShortName} destination`,
                      // We also pass the specific trip for a "watch-only" companion path.
                      focusTripId: a.tripId,
                    },
                  })
                }
              >
                <Card className="mb-2">
                  <View className="flex-row items-center">
                    <RouteChip shortName={a.routeShortName} large />
                    <View className="flex-1 ml-3">
                      <Text
                        className="text-base font-semibold text-slate-900 dark:text-white"
                        numberOfLines={1}
                      >
                        {a.tripHeadsign}
                      </Text>
                      <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Scheduled {formatClock(a.scheduledArrivalTime)}
                        {deviationLabel ? ` · ${deviationLabel}` : ""}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-lg font-extrabold text-brand-700 dark:text-brand-300">
                        {formatRelativeMinutes(boardTime)}
                      </Text>
                      <View className="mt-1">
                        <ConfidenceBadge confidence={conf} />
                      </View>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

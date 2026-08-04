/**
 * Trips tab — recent destinations + one-tap re-plan.
 *
 * Uses AsyncStorage-backed recents (see `services/storage.ts`). Tapping any
 * entry re-runs the planner for that origin→destination pair.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRecents } from "@/hooks/useRecents";
import { clearRecents } from "@/services/storage";

export default function TripsTab() {
  const router = useRouter();
  const recentsQ = useRecents();

  const recents = recentsQ.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-surface-soft dark:bg-surface-dark" edges={["top"]}>
      <View className="px-4 pt-2">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-2xl bg-brand-600 items-center justify-center mr-2.5">
              <Ionicons name="time" size={22} color="#fff" />
            </View>
            <View>
              <Text className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Trips
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Places you've been · tap to plan again
              </Text>
            </View>
          </View>
          {recents.length > 0 ? (
            <Pressable
              onPress={async () => {
                await clearRecents();
                await recentsQ.refetch();
              }}
              className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl"
            >
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: 24 }}>
        {recentsQ.isLoading ? (
          <View className="gap-2">
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : recents.length === 0 ? (
          <Card className="items-center py-10">
            <Ionicons name="compass-outline" size={40} color="#a3a099" />
            <Text className="mt-3 font-bold text-slate-900 dark:text-white">
              No trips yet
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-center px-6">
              Plan a trip from Home and it'll show up here for quick re-runs.
            </Text>
          </Card>
        ) : (
          <View className="gap-2">
            {recents.map((r) => (
              <Pressable
                key={r.id}
                onPress={() =>
                  router.push({
                    pathname: "/results",
                    params: {
                      destLat: String(r.location.latitude),
                      destLon: String(r.location.longitude),
                      destName: r.name,
                    },
                  })
                }
              >
                <Card>
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-2xl bg-brand-100 dark:bg-brand-900/50 items-center justify-center mr-3">
                      <Ionicons name="location" size={20} color="#1a9d7a" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text
                        className="text-base font-bold text-slate-900 dark:text-white"
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatWhen(r.visitedAt)}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Text className="text-[11px] font-bold text-brand-600 dark:text-brand-300 mr-1">
                        RE-PLAN
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color="#1a9d7a" />
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatWhen(epochMs: number): string {
  const diffSec = Math.round((Date.now() - epochMs) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(epochMs).toLocaleDateString();
}

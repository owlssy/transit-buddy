import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { RouteChip } from "./ui/RouteChip";
import type { OBARoute, OBAStop } from "@/types";
import { formatDistance } from "@/utils/distance";

interface StopListItemProps {
  stop: OBAStop;
  distanceM?: number;
  /** OBA `references.routes` for this stop, used to render route pills. */
  routesById?: Record<string, OBARoute>;
  onPress?: () => void;
}

/**
 * Rich nearby-stop card. Shows the stop name, distance, and — most
 * importantly — colored pills for every route that serves it. Route pills
 * are the fastest visual anchor for a rider ("does the 545 stop here?").
 */
export function StopListItem({ stop, distanceM, routesById, onPress }: StopListItemProps) {
  // Limit visible chips so we don't wrap into wall-of-badges on major stops.
  const routes = (stop.routeIds ?? []).slice(0, 6);
  const overflow = Math.max(0, (stop.routeIds?.length ?? 0) - routes.length);

  return (
    <Pressable onPress={onPress} className="mb-2">
      <View className="p-3 rounded-lg border-2 border-coffee/12 bg-cream">
        <View className="flex-row items-start">
          <View className="w-11 h-11 rounded-lg bg-sage items-center justify-center mr-3">
            <Ionicons name="bus" size={22} color="#2a1c12" />
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center">
              <Text
                className="flex-1 text-base font-bold text-coffee"
                numberOfLines={1}
              >
                {stop.name}
              </Text>
              {distanceM !== undefined ? (
                <View className="ml-2 bg-sage-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[11px] font-semibold text-coffee">
                    {formatDistance(distanceM)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="text-xs text-coffee/60 mt-0.5">
              Stop #{stop.code}
              {stop.direction ? ` · heading ${stop.direction}` : ""}
            </Text>

            {routes.length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5 mt-2">
                {routes.map((rid) => {
                  const r = routesById?.[rid];
                  return (
                    <RouteChip
                      key={rid}
                      shortName={r?.shortName ?? shortIdFallback(rid)}
                      color={r?.color}
                    />
                  );
                })}
                {overflow > 0 ? (
                  <View className="bg-sage-100 px-2 py-1 rounded-lg">
                    <Text className="text-xs font-semibold text-coffee">
                      +{overflow}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** OBA route IDs look like "1_100002". Show the trailing part if `shortName` is missing. */
function shortIdFallback(routeId: string): string {
  const parts = routeId.split("_");
  return parts[parts.length - 1] ?? routeId;
}

import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import type { TripLeg } from "@/types";
import { formatDuration } from "@/utils/time";

interface ProgressTimelineProps {
  legs: TripLeg[];
  activeIndex: number;
  stopsRemaining?: number;
}

/**
 * Vertical stepper showing the whole journey and where the user is now.
 * The active leg is highlighted; completed legs are muted with a checkmark;
 * upcoming legs are outlined.
 */
export function ProgressTimeline({
  legs,
  activeIndex,
  stopsRemaining,
}: ProgressTimelineProps) {
  return (
    <View>
      {legs.map((leg, i) => {
        const state: "done" | "active" | "todo" =
          i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
        const isLast = i === legs.length - 1;
        return (
          <View key={i} className="flex-row">
            {/* Left rail: icon + connector */}
            <View className="items-center mr-3" style={{ width: 32 }}>
              <TimelineDot leg={leg} state={state} />
              {!isLast ? (
                <View
                  className={`w-0.5 flex-1 mt-1 ${
                    state === "done" ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  style={{ minHeight: 24 }}
                />
              ) : null}
            </View>

            {/* Right content */}
            <View className={`flex-1 pb-4 ${state === "todo" ? "opacity-60" : ""}`}>
              <Text className="text-base font-semibold text-slate-900 dark:text-white">
                {legTitle(leg)}
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {legSubtitle(leg, state === "active" ? stopsRemaining : undefined)}
              </Text>
              <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {formatDuration(leg.durationSec)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TimelineDot({
  leg,
  state,
}: {
  leg: TripLeg;
  state: "done" | "active" | "todo";
}) {
  const iconName = ICON_BY_KIND[leg.kind];
  const bg =
    state === "done"
      ? "bg-brand-500"
      : state === "active"
        ? "bg-brand-600 ring-2 ring-brand-200"
        : "bg-slate-200 dark:bg-slate-700";
  const color = state === "todo" ? "#726f68" : "#fff";
  return (
    <View
      className={`w-8 h-8 rounded-full items-center justify-center ${bg}`}
      style={
        state === "active"
          ? {
              shadowColor: "#1a9d7a",
              shadowOpacity: 0.4,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
              elevation: 4,
            }
          : undefined
      }
    >
      {state === "done" ? (
        <Ionicons name="checkmark" size={18} color={color} />
      ) : (
        <Ionicons name={iconName} size={16} color={color} />
      )}
    </View>
  );
}

const ICON_BY_KIND: Record<TripLeg["kind"], keyof typeof Ionicons.glyphMap> = {
  walk: "walk",
  drive: "car",
  wait: "time",
  ride: "bus",
  transfer: "swap-horizontal",
};

function legTitle(leg: TripLeg): string {
  switch (leg.kind) {
    case "walk":
      return "Walk";
    case "drive":
      return "Drive / Rideshare";
    case "wait":
      return `Wait for Route ${leg.routeShortName ?? ""}`;
    case "ride":
      return `Ride Route ${leg.routeShortName ?? ""}`;
    case "transfer":
      return "Transfer";
    default:
      return "";
  }
}

function legSubtitle(leg: TripLeg, stopsRemaining?: number): string {
  switch (leg.kind) {
    case "walk":
    case "drive":
      return leg.instructions ?? "";
    case "wait":
      return leg.boardStopName ?? "";
    case "ride":
      if (stopsRemaining !== undefined) {
        return `${stopsRemaining} stop${stopsRemaining === 1 ? "" : "s"} remaining`;
      }
      return `${leg.stopsCount ?? "?"} stops → ${leg.alightStopName ?? ""}`;
    case "transfer":
      return leg.instructions ?? "";
  }
}

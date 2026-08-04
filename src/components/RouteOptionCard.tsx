import { Ionicons } from "@expo/vector-icons";
import { Fragment } from "react";
import { Pressable, Text, View } from "react-native";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { ConfidenceBadge } from "./ui/ConfidenceBadge";
import { RouteChip } from "./ui/RouteChip";
import { StarRating } from "./ui/StarRating";
import type { TripLeg, TripPlan } from "@/types";
import { formatDistance } from "@/utils/distance";
import { formatClock, formatDuration } from "@/utils/time";

interface RouteOptionCardProps {
  plan: TripPlan;
  onPress: () => void;
}

/**
 * Rich Route Results card.
 *
 * Layout:
 *   [tag row]                                 (stress-free / fastest / walkable badges)
 *   [leg strip: walk → bus 545 → transfer → bus A Line → walk]
 *   ------------------------------------------
 *   [total time]        [walk · transfers]
 *   [arrive by X]              [confidence]
 *   [stress score row]  ★★★★ Stress-Free  "Only one transfer and short walking."
 */
export function RouteOptionCard({ plan, onPress }: RouteOptionCardProps) {
  const stars = Math.max(1, Math.min(5, Math.round(plan.stressScore / 20)));
  const isWalkOnly = plan.legs.every((l) => l.kind === "walk");

  return (
    <Pressable onPress={onPress} style={{ transform: [{ scale: 1 }] }}>
      <Card className="mb-3 p-0 overflow-hidden">
        {plan.tags.length > 0 || isWalkOnly ? (
          <View className="flex-row flex-wrap gap-1.5 px-4 pt-4">
            {plan.tags.includes("stress-free") ? (
              <Badge label="Stress-Free" tone="green" icon="sparkles" />
            ) : null}
            {plan.tags.includes("fastest") ? (
              <Badge label="Fastest" tone="brand" icon="flash" />
            ) : null}
            {plan.tags.includes("least-walking") ? (
              <Badge label="Least Walking" tone="amber" icon="walk" />
            ) : null}
            {isWalkOnly ? (
              <Badge label="Walking only — no direct transit" tone="red" icon="warning" />
            ) : null}
          </View>
        ) : null}

        <View className="px-4 pt-3">
          <LegStrip legs={plan.legs} />
        </View>

        <View className="px-4 mt-3 flex-row items-end justify-between">
          <View>
            <Text className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {formatDuration(plan.totalDurationSec)}
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Arrive by {formatClock(plan.arrivalTime)}
            </Text>
          </View>
          <ConfidenceBadge confidence={plan.confidence} />
        </View>

        <View className="mx-4 my-3 h-px bg-slate-100 dark:bg-slate-700" />

        <View className="flex-row items-center px-4 pb-4">
          <StatChip
            icon="walk"
            label={formatDistance(plan.totalWalkingMeters)}
          />
          <StatChip
            icon="swap-horizontal"
            label={
              plan.transferCount === 0
                ? "No transfer"
                : `${plan.transferCount} transfer${plan.transferCount === 1 ? "" : "s"}`
            }
          />
          <View className="flex-1 items-end">
            <View className="flex-row items-center">
              <StarRating value={stars} />
              <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-1.5">
                {plan.stressLabel}
              </Text>
            </View>
            <Text
              className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 text-right"
              numberOfLines={1}
            >
              {plan.stressReason}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

// ---------------- Sub-components ----------------

function LegStrip({ legs }: { legs: TripLeg[] }) {
  // Collapse consecutive wait+ride into just the ride so the strip reads:
  //   walk → bus 545 → transfer → bus A Line → walk
  const visible = legs.filter((l) => l.kind !== "wait");
  return (
    <View className="flex-row items-center flex-wrap gap-1.5">
      {visible.map((leg, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <Ionicons name="chevron-forward" size={14} color="#a3a099" />
          ) : null}
          <LegPill leg={leg} />
        </Fragment>
      ))}
    </View>
  );
}

function LegPill({ leg }: { leg: TripLeg }) {
  if (leg.kind === "ride") {
    return <RouteChip shortName={leg.routeShortName ?? "?"} />;
  }
  if (leg.kind === "walk") {
    return (
      <View className="flex-row items-center bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
        <Ionicons name="walk" size={14} color="#4a4844" />
        <Text className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 ml-1">
          {leg.distanceMeters ? formatDistance(leg.distanceMeters) : ""}
        </Text>
      </View>
    );
  }
  if (leg.kind === "drive") {
    return (
      <View className="flex-row items-center bg-accent-50 dark:bg-accent-700/40 px-2 py-1 rounded-lg">
        <Ionicons name="car" size={14} color="#077483" />
        <Text className="text-[11px] font-semibold text-accent-700 dark:text-accent-100 ml-1">
          {leg.distanceMeters ? formatDistance(leg.distanceMeters) : ""}
        </Text>
      </View>
    );
  }
  if (leg.kind === "transfer") {
    return (
      <View className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 items-center justify-center">
        <Ionicons name="swap-horizontal" size={13} color="#a86f00" />
      </View>
    );
  }
  return null;
}

function StatChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View className="flex-row items-center mr-3">
      <Ionicons name={icon} size={13} color="#726f68" />
      <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">
        {label}
      </Text>
    </View>
  );
}

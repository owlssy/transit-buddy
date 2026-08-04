import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Card } from "./ui/Card";
import type { TripPhase } from "@/services/tripTracker";

type IoniconName = keyof typeof Ionicons.glyphMap;

interface RideCompanionCardProps {
  phase: TripPhase;
  primary: string;
  secondary?: string;
  routeShortName?: string;
}

/**
 * The huge headline card at the top of the Ride Companion screen.
 * One instruction at a time, large text, high contrast — designed for
 * quick reads on a moving bus.
 */
export function RideCompanionCard({
  phase,
  primary,
  secondary,
  routeShortName,
}: RideCompanionCardProps) {
  const { bg, icon, accent } = PHASE_STYLE[phase];
  return (
    <Card className={`${bg} p-6 mb-4`}>
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons name={icon} size={24} color={accent} />
        <Text className="text-sm font-semibold uppercase tracking-wide" style={{ color: accent }}>
          {PHASE_LABEL[phase]}
        </Text>
        {routeShortName ? (
          <View className="ml-auto bg-white/90 px-2 py-1 rounded-lg">
            <Text className="font-bold" style={{ color: accent }}>
              {routeShortName}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="text-3xl font-extrabold text-slate-900 leading-tight">
        {primary}
      </Text>
      {secondary ? (
        <Text className="text-base text-slate-700 mt-2">{secondary}</Text>
      ) : null}
    </Card>
  );
}

const PHASE_LABEL: Record<TripPhase, string> = {
  "walking-to-stop": "Walk to stop",
  "waiting-at-stop": "Wait for bus",
  "on-bus": "On the bus",
  "your-stop-is-next": "Your stop is next",
  "walking-to-destination": "Almost there",
  arrived: "You've arrived",
};

const PHASE_STYLE: Record<TripPhase, { bg: string; icon: IoniconName; accent: string }> = {
  "walking-to-stop": { bg: "bg-brand-50", icon: "walk", accent: "#1a9d7a" },
  "waiting-at-stop": { bg: "bg-amber-50", icon: "time", accent: "#a86f00" },
  "on-bus": { bg: "bg-brand-50", icon: "bus", accent: "#1a9d7a" },
  "your-stop-is-next": { bg: "bg-red-50", icon: "notifications", accent: "#b83d2f" },
  "walking-to-destination": { bg: "bg-green-50", icon: "walk", accent: "#067057" },
  arrived: { bg: "bg-green-50", icon: "checkmark-circle", accent: "#067057" },
};

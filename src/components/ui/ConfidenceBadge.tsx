import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import type { Confidence } from "@/types";

/**
 * High · Medium · Low confidence, shown as a colored dot icon + label.
 * Compact by default; use `expanded` in navigation views to show reasons.
 */
export function ConfidenceBadge({
  confidence,
  expanded = false,
}: {
  confidence: Confidence;
  expanded?: boolean;
}) {
  const label =
    confidence.level === "high" ? "High" : confidence.level === "medium" ? "Medium" : "Low";

  const bg =
    confidence.level === "high"
      ? "bg-green-50 dark:bg-green-900/40"
      : confidence.level === "medium"
        ? "bg-amber-50 dark:bg-amber-900/40"
        : "bg-red-50 dark:bg-red-900/40";

  const text =
    confidence.level === "high"
      ? "text-green-700 dark:text-green-100"
      : confidence.level === "medium"
        ? "text-amber-700 dark:text-amber-100"
        : "text-red-700 dark:text-red-100";

  const dotColor =
    confidence.level === "high" ? "#04946d" : confidence.level === "medium" ? "#a86f00" : "#b83d2f";

  return (
    <View className={`${bg} px-3 py-1.5 rounded-full`}>
      <View className="flex-row items-center">
        <Ionicons name="ellipse" size={8} color={dotColor} style={{ marginRight: 5 }} />
        <Text className={`${text} text-xs font-semibold`}>{label} confidence</Text>
      </View>
      {expanded && confidence.reasons.length > 0 ? (
        <Text className={`${text} text-[11px] mt-1`}>{confidence.reasons[0]}</Text>
      ) : null}
    </View>
  );
}

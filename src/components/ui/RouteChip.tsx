import { Text, View } from "react-native";

/**
 * A pill representing a transit route (e.g., "545"). Uses a brand color
 * background so it visually anchors route-related UI.
 */
export function RouteChip({
  shortName,
  color,
  large = false,
}: {
  shortName: string;
  color?: string;
  large?: boolean;
}) {
  const bg = color ? { backgroundColor: `#${color}` } : undefined;
  return (
    <View
      style={bg}
      className={`${bg ? "" : "bg-brand-600"} rounded-lg items-center justify-center ${
        large ? "px-3 py-1.5 min-w-[52px]" : "px-2 py-1 min-w-[36px]"
      }`}
    >
      <Text
        className={`text-white font-bold ${large ? "text-lg" : "text-sm"}`}
        numberOfLines={1}
      >
        {shortName}
      </Text>
    </View>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

export function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <View className="flex-row" style={{ gap: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons
          key={i}
          name={i < filled ? "star" : "star-outline"}
          size={size}
          color="#a86f00"
        />
      ))}
    </View>
  );
}

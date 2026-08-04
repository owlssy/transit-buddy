import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface WarningBannerProps {
  title: string;
  message: string;
  onRecalculate?: () => void;
  onDismiss?: () => void;
}

/** Red banner used for Wrong Bus / Missed Stop alerts. */
export function WarningBanner({
  title,
  message,
  onRecalculate,
  onDismiss,
}: WarningBannerProps) {
  return (
    <View className="bg-transit-red rounded-2xl p-4 mb-4">
      <View className="flex-row items-start">
        <Ionicons name="warning" size={22} color="#fff" style={{ marginTop: 2 }} />
        <View className="flex-1 ml-2">
          <Text className="text-white font-bold text-base">{title}</Text>
          <Text className="text-white/90 text-sm mt-1">{message}</Text>
        </View>
      </View>
      <View className="flex-row gap-2 mt-3">
        {onRecalculate ? (
          <Pressable
            onPress={onRecalculate}
            className="flex-1 bg-white rounded-xl py-2.5 items-center"
          >
            <Text className="text-transit-red font-bold">Recalculate</Text>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            className="flex-1 bg-white/20 rounded-xl py-2.5 items-center"
          >
            <Text className="text-white font-semibold">Continue Anyway</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

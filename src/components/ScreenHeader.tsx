import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  return (
    <View className="px-4 pt-2 pb-4 flex-row items-center">
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={14}
          className="w-10 h-10 rounded-full bg-surface-muted dark:bg-surface-card items-center justify-center mr-3"
        >
          <Ionicons name="chevron-back" size={22} color="#100f0d" />
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text className="text-2xl font-extrabold text-slate-900 dark:text-white">{title}</Text>
        {subtitle ? (
          <Text className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

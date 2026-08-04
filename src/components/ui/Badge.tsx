import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type Tone = "brand" | "green" | "amber" | "red" | "slate";

const TONE: Record<Tone, { bg: string; text: string; iconColor: string }> = {
  brand: { bg: "bg-brand-50 dark:bg-brand-900/40", text: "text-brand-700 dark:text-brand-100", iconColor: "#04946d" },
  green: { bg: "bg-green-50 dark:bg-green-900/40", text: "text-green-700 dark:text-green-100", iconColor: "#04946d" },
  amber: { bg: "bg-amber-50 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-100", iconColor: "#a86f00" },
  red: { bg: "bg-red-50 dark:bg-red-900/40", text: "text-red-700 dark:text-red-100", iconColor: "#b83d2f" },
  slate: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-200", iconColor: "#726f68" },
};

export function Badge({
  label,
  tone = "slate",
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const t = TONE[tone];
  return (
    <View className={`${t.bg} px-2.5 py-1 rounded-full flex-row items-center`}>
      {icon ? <Ionicons name={icon} size={12} color={t.iconColor} style={{ marginRight: 4 }} /> : null}
      <Text className={`${t.text} text-xs font-semibold`}>{label}</Text>
    </View>
  );
}

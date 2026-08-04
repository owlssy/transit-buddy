import { View, type ViewProps } from "react-native";

/**
 * Rounded elevated card. The go-to container for grouping content.
 */
export function Card({ className = "", ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-2xl bg-surface-light dark:bg-surface-card p-4 shadow-sm ${className}`}
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
      {...rest}
    />
  );
}

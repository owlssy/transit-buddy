import { Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const VARIANT_CLASSES: Record<Variant, { bg: string; text: string }> = {
  primary: { bg: "bg-brand-600 active:bg-brand-700", text: "text-white" },
  secondary: {
    bg: "bg-brand-50 active:bg-brand-100 dark:bg-brand-900/40",
    text: "text-brand-700 dark:text-brand-100",
  },
  ghost: { bg: "bg-transparent active:bg-slate-100", text: "text-brand-700" },
  danger: { bg: "bg-transit-red active:bg-red-600", text: "text-white" },
};

const SIZE_CLASSES = {
  sm: "px-3 py-2 rounded-xl",
  md: "px-4 py-3 rounded-2xl",
  lg: "px-5 py-4 rounded-2xl",
} as const;

export function Button({
  label,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const v = VARIANT_CLASSES[variant];
  return (
    <Pressable
      className={`${v.bg} ${SIZE_CLASSES[size]} items-center justify-center ${disabled ? "opacity-40" : ""} ${className}`}
      disabled={disabled}
      {...rest}
    >
      <Text className={`${v.text} text-base font-semibold`}>{label}</Text>
    </Pressable>
  );
}

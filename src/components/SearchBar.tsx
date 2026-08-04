import { Ionicons } from "@expo/vector-icons";
import { forwardRef } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

interface SearchBarProps extends Omit<TextInputProps, "onChange"> {
  onClear?: () => void;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
}

export const SearchBar = forwardRef<TextInput, SearchBarProps>(function SearchBar(
  { onClear, leadingIcon = "search", value, ...rest },
  ref,
) {
  return (
    <View className="flex-row items-center bg-cream border-2 border-coffee/15 rounded-2xl px-4 py-3">
      <Ionicons name={leadingIcon} size={20} color="#2a1c12" />
      <TextInput
        ref={ref}
        value={value}
        placeholderTextColor="#2a1c1299"
        className="flex-1 ml-3 text-base text-coffee"
        returnKeyType="search"
        autoCorrect={false}
        {...rest}
      />
      {value ? (
        <Pressable onPress={onClear} hitSlop={10}>
          <Ionicons name="close-circle" size={20} color="#2a1c1299" />
        </Pressable>
      ) : null}
    </View>
  );
});

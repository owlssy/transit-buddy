import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

/** Simple pulsing skeleton block for loading states. */
export function Skeleton({
  className = "",
  height = 16,
  width,
}: {
  className?: string;
  height?: number;
  width?: number | string;
}) {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={{ opacity: anim, height, width: width as any }}
      className={`bg-slate-200 dark:bg-slate-700 rounded-lg ${className}`}
    >
      <View />
    </Animated.View>
  );
}

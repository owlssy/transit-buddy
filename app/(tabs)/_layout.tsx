/**
 * Bottom tab bar layout — Home / Map / On Board / Trips.
 *
 * Uses expo-router's `Tabs` (which wraps @react-navigation/bottom-tabs) with
 * custom Ionicons + brand colors. All full-screen routes (results, navigate,
 * stop detail) live OUTSIDE this group and push over the tabs.
 */

import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";

export default function TabLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1a9d7a",
        tabBarInactiveTintColor: isDark ? "#726f68" : "#a3a099",
        tabBarStyle: {
          backgroundColor: isDark ? "#100f0d" : "#fffefc",
          borderTopColor: isDark ? "#1c1b18" : "#e6e3da",
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "map" : "map-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="onboard"
        options={{
          title: "On Board",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "bus" : "bus-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "time" : "time-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

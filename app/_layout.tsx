/**
 * Root layout. Sets up:
 *   - React Query provider (shared cache for OBA data)
 *   - Safe area + status bar
 *   - Notification permissions (fire-and-forget)
 *   - A stack for our routes
 */

import "../global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ensureNotificationsReady } from "@/services/notifications";

export default function RootLayout() {
  // A single QueryClient per app instance; memoized so hot-reload doesn't churn.
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
    [],
  );

  const scheme = useColorScheme();

  useEffect(() => {
    // Non-blocking. If the user denies, we simply skip local notifs.
    ensureNotificationsReady();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: scheme === "dark" ? "#100f0d" : "#faf9f6",
              },
            }}
          />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

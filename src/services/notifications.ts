/**
 * Notifications service.
 *
 * We use local notifications for turn-by-turn ride guidance (they fire
 * instantly and don't require a push server). Push notifications are set up
 * here as well so a future server can send trip-wide alerts.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { formatDistance } from "@/utils/distance";

let configured = false;

/**
 * Idempotent. Call once on app start.
 * - Sets up the foreground handler so notifications actually show while the
 *   app is open.
 * - Requests permission (no-op on iOS if already granted).
 */
export async function ensureNotificationsReady(): Promise<boolean> {
  if (!configured) {
    Notifications.setNotificationHandler({
      // Fields cover both SDK 51 (`shouldShowAlert`) and 52+ (banner/list split).
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("trip-guidance", {
        name: "Trip guidance",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 200, 250],
        lightColor: "#25b890",
      });
    }
    configured = true;
  }

  const perm = await Notifications.getPermissionsAsync();
  if (perm.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export interface NotifyOptions {
  title: string;
  body: string;
  /** ms from now. 0 = immediate. */
  delay?: number;
}

export async function notify(opts: NotifyOptions): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      sound: "default",
    },
    trigger:
      opts.delay && opts.delay > 0
        ? {
            // SDK 52+ requires an explicit `type` on the trigger object.
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(1, Math.round(opts.delay / 1000)),
            channelId: "trip-guidance",
          }
        : null,
  });
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ---------- Copy library ----------
// Kept as pure functions so screens can reuse the same phrasing on-screen.

export const notifCopy = {
  boardingSoon: (routeName: string, minutes: number) => ({
    title: "Bus arriving soon",
    body: `Route ${routeName} in ${minutes} min. Get ready to board.`,
  }),
  boardNow: (routeName: string) => ({
    title: "Board now",
    body: `Route ${routeName} is here. Board this bus.`,
  }),
  stayOn: (stopsRemaining: number) => ({
    title: "You're on the right bus",
    body: `Stay on for ${stopsRemaining} more stop${stopsRemaining === 1 ? "" : "s"}.`,
  }),
  yourStopIsNext: () => ({
    title: "Your stop is next",
    body: "Signal the driver and get ready to exit.",
  }),
  exitNow: (stopName: string) => ({
    title: "Exit now",
    body: `This is ${stopName}. Exit here.`,
  }),
  transfer: (nextRoute: string) => ({
    title: "Transfer here",
    body: `Walk to your next stop and board Route ${nextRoute}.`,
  }),
  almostThere: (meters: number) => ({
    title: "Almost there",
    body: `Walk ${formatDistance(meters)} to your destination.`,
  }),
  wrongBus: (expected: string, actual: string) => ({
    title: "Wrong bus",
    body: `You may be on Route ${actual} instead of Route ${expected}.`,
  }),
  missedStop: () => ({
    title: "Missed stop",
    body: "Looks like the bus passed your stop. We're finding a new route.",
  }),
} as const;

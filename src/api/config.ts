/**
 * Central configuration for the OneBusAway API.
 *
 * We source credentials from three places, in order of priority:
 *   1. `process.env.EXPO_PUBLIC_*` — inlined at build time by Expo
 *      when defined in a `.env` file. This is the recommended path.
 *   2. `Constants.expoConfig.extra.*` — set via `app.json > expo.extra`.
 *      Useful for baking values into a specific build variant.
 *   3. A safe default for the base URL (Puget Sound OBA server).
 *
 * The API key intentionally has NO default — leaving it blank surfaces a
 * clear runtime warning instead of silently failing with a 401.
 */

import Constants from "expo-constants";

type Extra = {
  onebusawayApiKey?: string;
  onebusawayBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const ONEBUSAWAY_BASE_URL =
  process.env.EXPO_PUBLIC_ONEBUSAWAY_BASE_URL ??
  extra.onebusawayBaseUrl ??
  "https://api.pugetsound.onebusaway.org";

export const ONEBUSAWAY_API_KEY =
  process.env.EXPO_PUBLIC_ONEBUSAWAY_API_KEY ?? extra.onebusawayApiKey ?? "";

export const IS_API_CONFIGURED = ONEBUSAWAY_API_KEY.trim().length > 0;

if (!IS_API_CONFIGURED && __DEV__) {
  // Print once at module load so developers know why they see mock/empty data.
  console.warn(
    "[TransitBuddy] No OneBusAway API key set. " +
      "Add EXPO_PUBLIC_ONEBUSAWAY_API_KEY to your .env file or " +
      "populate expo.extra.onebusawayApiKey in app.json, then restart Expo.",
  );
}

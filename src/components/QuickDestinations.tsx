import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { LatLng } from "@/types";

const TRACK_WIDTH = 56;

/**
 * PNW landmark quick-picks. Shown as a horizontally scrolling row of tiles
 * on the Home screen so a rider can start a trip in one tap without typing.
 *
 * Coordinates are approximate but well within OBA's stop-search radius, so
 * the trip planner has real transit options to work with.
 */
export interface QuickPlace {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  location: LatLng;
}

export const PNW_QUICK_PLACES: QuickPlace[] = [
  {
    id: "sea-airport",
    // Coordinate is the SeaTac/Airport Link Light Rail station, not the terminal
    // building — that's where transit actually lands, and it's a short covered
    // walkway from there to the concourses.
    label: "SEA Airport",
    icon: "airplane",
    color: "#013d7d",
    location: { latitude: 47.4444, longitude: -122.2971 },
  },
  {
    id: "downtown",
    label: "Downtown",
    icon: "business",
    color: "#0abace",
    location: { latitude: 47.6062, longitude: -122.3321 },
  },
  {
    id: "uw",
    label: "UW",
    icon: "school",
    color: "#04946d",
    location: { latitude: 47.6553, longitude: -122.3035 },
  },
  {
    id: "space-needle",
    label: "Space Needle",
    icon: "rocket",
    color: "#0d55a3",
    location: { latitude: 47.6205, longitude: -122.3493 },
  },
  {
    id: "pike-place",
    label: "Pike Place",
    icon: "fish",
    color: "#a86f00",
    location: { latitude: 47.6089, longitude: -122.3413 },
  },
  {
    id: "climate-arena",
    label: "Kraken Arena",
    icon: "basketball",
    color: "#065441",
    location: { latitude: 47.6222, longitude: -122.354 },
  },
  {
    id: "microsoft",
    label: "Microsoft",
    icon: "briefcase",
    color: "#25b890",
    location: { latitude: 47.6423, longitude: -122.1391 },
  },
  {
    id: "bellevue-downtown",
    label: "Bellevue",
    icon: "storefront",
    color: "#012f61",
    location: { latitude: 47.6153, longitude: -122.1955 },
  },
];

export function QuickDestinations({
  onSelect,
}: {
  onSelect: (place: QuickPlace) => void;
}) {
  // Drives the little "scroll track" below the row — a thumb that slides to
  // show there's more to see, since a bare horizontal ScrollView gives no
  // hint it's scrollable once the native indicator is hidden.
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollX(e.nativeEvent.contentOffset.x);
  };

  const canScroll = contentWidth > layoutWidth + 1;
  const thumbWidth = canScroll
    ? Math.max(18, (layoutWidth / contentWidth) * TRACK_WIDTH)
    : TRACK_WIDTH;
  const maxScroll = Math.max(1, contentWidth - layoutWidth);
  const thumbTravel = TRACK_WIDTH - thumbWidth;
  const thumbX = canScroll
    ? Math.min(thumbTravel, (scrollX / maxScroll) * thumbTravel)
    : 0;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {PNW_QUICK_PLACES.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onSelect(p)}
            className="items-center"
            style={{ width: 76 }}
          >
            <View
              className="w-14 h-14 rounded-lg items-center justify-center border-2 border-coffee/10"
              style={{ backgroundColor: p.color }}
            >
              <Ionicons name={p.icon} size={26} color="#f4f1e8" />
            </View>
            <Text
              className="text-[11px] font-semibold text-coffee mt-1.5 text-center"
              numberOfLines={1}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {canScroll ? (
        <View
          className="self-center mt-2 rounded-full bg-coffee/15 overflow-hidden"
          style={{ width: TRACK_WIDTH, height: 4 }}
        >
          <View
            className="h-full rounded-full bg-coffee/60"
            style={{ width: thumbWidth, transform: [{ translateX: thumbX }] }}
          />
        </View>
      ) : null}
    </View>
  );
}

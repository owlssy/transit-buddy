/**
 * Navigation / Ride Companion screen.
 *
 * This is the signature TransitBuddy experience — it wires together:
 *
 *   • A live MapView with user + bus positions and the route polyline
 *   • A big instruction card (walk, wait, ride, exit, arrived)
 *   • A collapsible timeline of the whole journey
 *   • Wrong-bus and missed-stop detection with recovery actions
 *   • Local notifications at each phase transition
 *
 * All state derives from a single call to `computeTripState()` on each
 * GPS/vehicle update, so the UI stays coherent even when data races.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRouteStops } from "@/api/oneBusAway";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ProgressTimeline } from "@/components/ProgressTimeline";
import { RideCompanionCard } from "@/components/RideCompanionCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { WarningBanner } from "@/components/WarningBanner";
import { Card } from "@/components/ui/Card";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { useLocation } from "@/hooks/useLocation";
import { useTripDetails } from "@/hooks/useVehicle";
import { notify, notifCopy } from "@/services/notifications";
import { computeTripState, type TripPhase } from "@/services/tripTracker";
import { setActiveTrip, useActiveTrip } from "@/services/tripStore";
import type { LatLng } from "@/types";
import { formatDistance } from "@/utils/distance";
import { decodePolyline, snapRideLegToShape } from "@/utils/polyline";
import { formatClock } from "@/utils/time";

export default function NavigateScreen() {
  const router = useRouter();
  const plan = useActiveTrip();
  const { coords } = useLocation();

  const rideLeg = plan?.legs.find((l) => l.kind === "ride");

  // Live trip data — updates every ~10s while the ride leg is active.
  const tripDetailsQ = useTripDetails(rideLeg?.tripId ?? null);
  const tripStatus = tripDetailsQ.data?.entry.status ?? null;
  const vehicleLocation = tripStatus?.position
    ? { latitude: tripStatus.position.lat, longitude: tripStatus.position.lon }
    : null;

  // Route shape polyline (for the map).
  const routeStopsQ = useQuery({
    queryKey: ["route-stops", rideLeg?.routeId],
    queryFn: () => getRouteStops(rideLeg!.routeId!),
    enabled: !!rideLeg?.routeId,
    staleTime: 60 * 60_000,
  });
  const polylineCoords = useMemo(() => {
    const segments = (routeStopsQ.data?.entry.polylines ?? []).map((p) =>
      decodePolyline(p.points),
    );
    if (rideLeg?.from && rideLeg?.to) {
      const snapped = snapRideLegToShape(segments, rideLeg.from, rideLeg.to);
      if (snapped) return snapped;
    }
    return segments[0] ?? null;
  }, [routeStopsQ.data, rideLeg]);

  // Fetch route shape data for EVERY ride leg (not just the current one) so
  // the full-journey overview can follow the real transit line for each of
  // them — a straight line from board stop to alight stop can cut right
  // across a lake or the Sound, which is not the bus/train's actual path.
  const rideLegs = useMemo(
    () => plan?.legs.filter((l) => l.kind === "ride") ?? [],
    [plan],
  );
  const rideShapeQueries = useQueries({
    queries: rideLegs.map((leg) => ({
      queryKey: ["route-stops", leg.routeId],
      queryFn: () => getRouteStops(leg.routeId!),
      enabled: !!leg.routeId,
      staleTime: 60 * 60_000,
    })),
  });

  // Full-journey overview: origin → every leg's path → destination. Walk
  // legs are a straight line (short enough that this is fine); ride legs
  // are snapped onto their route's real shape so they track the actual
  // transit line instead of a straight "as the crow flies" line.
  const overviewCoords = useMemo(() => {
    if (!plan) return [];
    const pts: LatLng[] = [plan.origin];

    plan.legs.forEach((leg) => {
      if (!leg.to) return;

      if (leg.kind === "ride" && leg.from) {
        const idx = rideLegs.indexOf(leg);
        const segments = (rideShapeQueries[idx]?.data?.entry.polylines ?? []).map((p) =>
          decodePolyline(p.points),
        );
        const snapped = snapRideLegToShape(segments, leg.from, leg.to);
        if (snapped && snapped.length >= 2) {
          pts.push(...snapped);
          return;
        }
      }

      pts.push(leg.to);
    });

    const last = pts[pts.length - 1];
    if (
      !last ||
      last.latitude !== plan.destination.latitude ||
      last.longitude !== plan.destination.longitude
    ) {
      pts.push(plan.destination);
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, rideLegs, rideShapeQueries.map((q) => q.dataUpdatedAt).join(",")]);

  const mapRef = useRef<MapView>(null);
  useEffect(() => {
    if (overviewCoords.length < 2) return;
    // Slight delay so the map has mounted/measured before we fit to it.
    const id = setTimeout(() => {
      mapRef.current?.fitToCoordinates(overviewCoords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  // Compute derived trip state from all inputs.
  const state = useMemo(() => {
    if (!plan) return null;
    return computeTripState({
      plan,
      userLocation: coords,
      vehicleLocation,
      tripStatus,
    });
  }, [plan, coords, vehicleLocation, tripStatus]);

  // Fire a local notification when the phase changes.
  const lastPhaseRef = useRef<TripPhase | null>(null);
  useEffect(() => {
    if (!state || !plan) return;
    if (lastPhaseRef.current === state.phase) return;
    lastPhaseRef.current = state.phase;
    firePhaseNotification(state.phase, plan, state.stopsRemaining);
  }, [state?.phase, state?.stopsRemaining, plan]);

  // Warning acknowledgment (user tapped "Continue Anyway").
  const [warningDismissed, setWarningDismissed] = useState(false);
  useEffect(() => {
    setWarningDismissed(false);
  }, [state?.warning]);

  // ---- No active plan (deep-link or refresh) ----
  if (!plan) {
    return (
      <SafeAreaView className="flex-1 bg-surface-soft dark:bg-surface-dark" edges={["top"]}>
        <ScreenHeader title="Trip" onBack={() => router.replace("/")} />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="map-outline" size={40} color="#a3a099" />
          <Text className="mt-3 text-slate-900 dark:text-white font-semibold">
            No active trip
          </Text>
          <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-center">
            Pick a route from Home to start the ride companion.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---- Map region: fit user + destination ----
  const initialRegion = {
    latitude: (plan.origin.latitude + plan.destination.latitude) / 2,
    longitude: (plan.origin.longitude + plan.destination.longitude) / 2,
    latitudeDelta:
      Math.abs(plan.origin.latitude - plan.destination.latitude) * 2 + 0.02,
    longitudeDelta:
      Math.abs(plan.origin.longitude - plan.destination.longitude) * 2 + 0.02,
  };

  const primary = phasePrimary(state?.phase ?? "walking-to-stop", plan, state?.stopsRemaining);
  const secondary = phaseSecondary(state?.phase ?? "walking-to-stop", plan);

  return (
    <SafeAreaView className="flex-1 bg-surface-soft dark:bg-surface-dark" edges={["top"]}>
      <ScreenHeader
        title="Ride Companion"
        subtitle={`Arrive ${formatClock(plan.arrivalTime)}`}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => {
              setActiveTrip(null);
              router.replace("/");
            }}
            className="w-10 h-10 rounded-full bg-surface-muted dark:bg-surface-card items-center justify-center"
            hitSlop={10}
          >
            <Ionicons name="close" size={20} color="#100f0d" />
          </Pressable>
        }
      />

      {/* Map */}
      <View style={{ height: 240 }} className="mx-4 rounded-2xl overflow-hidden">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={Platform.OS === "android"}
        >
          {/* Full-journey overview — always visible so the whole route from
              here to the destination is highlighted, not just whichever leg
              has detailed shape data loaded. */}
          {overviewCoords.length >= 2 ? (
            <Polyline
              coordinates={overviewCoords}
              strokeColor="#013d7d"
              strokeWidth={3}
              lineDashPattern={[6, 6]}
            />
          ) : null}
          {/* Actual street-following shape for the current ride leg, drawn
              on top of the overview line once it's loaded. */}
          {polylineCoords ? (
            <Polyline
              coordinates={polylineCoords}
              strokeColor="#1a9d7a"
              strokeWidth={4}
            />
          ) : null}
          <Marker coordinate={plan.origin} title="Start">
            <View className="bg-navy-600 rounded-full p-1.5">
              <Ionicons name="ellipse" size={12} color="#fff" />
            </View>
          </Marker>
          <Marker coordinate={plan.destination} title={plan.destinationName}>
            <View className="bg-transit-green rounded-full p-1.5">
              <Ionicons name="flag" size={16} color="#fff" />
            </View>
          </Marker>
          {rideLeg?.from ? (
            <Marker coordinate={rideLeg.from} title={rideLeg.boardStopName ?? "Board here"}>
              <View className="bg-brand-600 rounded-full p-1.5">
                <Ionicons name="log-in" size={16} color="#fff" />
              </View>
            </Marker>
          ) : null}
          {rideLeg?.to ? (
            <Marker coordinate={rideLeg.to} title={rideLeg.alightStopName ?? "Exit here"}>
              <View className="bg-amber-500 rounded-full p-1.5">
                <Ionicons name="log-out" size={16} color="#fff" />
              </View>
            </Marker>
          ) : null}
          {vehicleLocation ? (
            <Marker coordinate={vehicleLocation} title={`Route ${rideLeg?.routeShortName}`}>
              <View className="bg-slate-900 rounded-full p-1.5">
                <Ionicons name="bus" size={16} color="#fff" />
              </View>
            </Marker>
          ) : null}
        </MapView>
      </View>

      <ScrollView
        className="flex-1 mt-4 px-4"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Warnings */}
        {state?.warning === "wrong-bus" && !warningDismissed ? (
          <WarningBanner
            title="It looks like you're on the wrong bus"
            message={state.warningDetail ?? "Route mismatch detected."}
            onRecalculate={() => router.replace("/")}
            onDismiss={() => setWarningDismissed(true)}
          />
        ) : null}
        {state?.warning === "missed-stop" && !warningDismissed ? (
          <WarningBanner
            title="You may have missed your stop"
            message={state.warningDetail ?? "We can plan a new route from here."}
            onRecalculate={() => router.replace("/")}
            onDismiss={() => setWarningDismissed(true)}
          />
        ) : null}

        {/* Big instruction card */}
        <RideCompanionCard
          phase={state?.phase ?? "walking-to-stop"}
          primary={primary}
          secondary={secondary}
          routeShortName={rideLeg?.routeShortName}
        />

        {/* Trip meta */}
        <Card className="mb-4">
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide">
                Trip confidence
              </Text>
              <Text className="text-slate-800 dark:text-slate-200 text-sm mt-1">
                {plan.confidence.reasons.join(" · ")}
              </Text>
            </View>
            <ConfidenceBadge confidence={plan.confidence} />
          </View>
        </Card>

        {/* Timeline */}
        <Card>
          <Text className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide mb-3">
            Journey
          </Text>
          <ProgressTimeline
            legs={plan.legs}
            activeIndex={state?.activeLegIndex ?? 0}
            stopsRemaining={state?.stopsRemaining}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- Copy helpers ----------

function phasePrimary(phase: TripPhase, plan: any, stopsRemaining?: number): string {
  const ride = plan.legs.find((l: any) => l.kind === "ride");
  switch (phase) {
    case "walking-to-stop":
      return `Walk ${formatDistance(plan.legs[0]?.distanceMeters ?? 0)} to Stop ${
        ride?.boardStopName?.split(" ")[0] ?? ride?.boardStopId ?? ""
      }.`;
    case "waiting-at-stop":
      return `Bus arriving soon.`;
    case "on-bus":
      return `Stay on for ${stopsRemaining ?? "a few"} stop${
        stopsRemaining === 1 ? "" : "s"
      }.`;
    case "your-stop-is-next":
      return `Your stop is next. Get ready to exit.`;
    case "walking-to-destination":
      return `Walk to ${plan.destinationName}.`;
    case "arrived":
      return `You've arrived at ${plan.destinationName}.`;
  }
}

function phaseSecondary(phase: TripPhase, plan: any): string | undefined {
  const ride = plan.legs.find((l: any) => l.kind === "ride");
  switch (phase) {
    case "walking-to-stop":
      return `You'll board Route ${ride?.routeShortName ?? ""} toward ${
        ride?.headsign ?? "your destination"
      }.`;
    case "waiting-at-stop":
      return `You are at ${ride?.boardStopName}. Watch for Route ${ride?.routeShortName}.`;
    case "on-bus":
      return `Exit at ${ride?.alightStopName}.`;
    case "your-stop-is-next":
      return `${ride?.alightStopName}.`;
    case "walking-to-destination":
      return `Almost there.`;
    case "arrived":
      return `Have a great day!`;
  }
}

function firePhaseNotification(phase: TripPhase, plan: any, stopsRemaining: number) {
  const ride = plan.legs.find((l: any) => l.kind === "ride");
  const routeName = ride?.routeShortName ?? "";
  switch (phase) {
    case "walking-to-stop":
      break; // nothing to notify on initial walk
    case "waiting-at-stop":
      notify(notifCopy.boardingSoon(routeName, 2));
      break;
    case "on-bus":
      notify(notifCopy.stayOn(stopsRemaining));
      break;
    case "your-stop-is-next":
      notify(notifCopy.yourStopIsNext());
      break;
    case "walking-to-destination":
      notify(notifCopy.exitNow(ride?.alightStopName ?? "your stop"));
      break;
    case "arrived":
      notify({ title: "You've arrived", body: "Enjoy your day!" });
      break;
  }
}

/**
 * Domain types for TransitBuddy.
 *
 * These mirror the OneBusAway REST API shapes but are intentionally trimmed
 * to only fields we actually use — a full generated schema would add noise.
 *
 * OBA REST reference: https://developer.onebusaway.org/api/where
 */

export type LatLng = { latitude: number; longitude: number };

// ---------- OBA primitives ----------

export interface OBAStop {
  id: string;
  code: string;
  name: string;
  direction?: string;
  lat: number;
  lon: number;
  locationType: number;
  wheelchairBoarding?: "ACCESSIBLE" | "NOT_ACCESSIBLE" | "UNKNOWN";
  routeIds: string[];
}

export interface OBARoute {
  id: string;
  agencyId: string;
  shortName: string;
  longName?: string;
  description?: string;
  type: number; // GTFS route_type: 3=bus, 1=subway, 0=tram/light rail, 2=rail
  url?: string;
  color?: string;
  textColor?: string;
}

export interface OBAAgency {
  id: string;
  name: string;
  url?: string;
  timezone: string;
  lang?: string;
  phone?: string;
}

export interface OBATripReference {
  id: string;
  routeId: string;
  tripShortName?: string;
  tripHeadsign?: string;
  serviceId: string;
  shapeId?: string;
  directionId?: string;
  blockId?: string;
}

export interface OBAReferences {
  agencies?: OBAAgency[];
  routes?: OBARoute[];
  stops?: OBAStop[];
  trips?: OBATripReference[];
  situations?: OBASituation[];
}

// ---------- Arrivals / Departures ----------

export interface OBAArrivalDeparture {
  routeId: string;
  routeShortName: string;
  routeLongName?: string;
  tripId: string;
  tripHeadsign: string;
  stopId: string;
  stopSequence: number;
  vehicleId?: string;
  predicted: boolean;
  predictedArrivalTime: number; // epoch ms; 0 = no prediction
  predictedDepartureTime: number;
  scheduledArrivalTime: number;
  scheduledDepartureTime: number;
  status?: string;
  distanceFromStop?: number;
  numberOfStopsAway?: number;
  serviceDate?: number;
  situationIds?: string[];
}

export interface OBAArrivalsForStop {
  stopId: string;
  arrivalsAndDepartures: OBAArrivalDeparture[];
  nearbyStopIds?: string[];
  situationIds?: string[];
}

// ---------- Vehicle position ----------

export interface OBAVehicleStatus {
  vehicleId: string;
  lastLocationUpdateTime: number;
  lastUpdateTime: number;
  location?: { lat: number; lon: number };
  tripId?: string;
  tripStatus?: OBATripStatus;
  phase?: string;
  status?: string;
}

export interface OBATripStatus {
  activeTripId: string;
  blockTripSequence?: number;
  serviceDate: number;
  scheduledDistanceAlongTrip?: number;
  totalDistanceAlongTrip?: number;
  distanceAlongTrip?: number;
  closestStop?: string;
  closestStopTimeOffset?: number;
  nextStop?: string;
  nextStopTimeOffset?: number;
  scheduleDeviation?: number; // seconds; positive = late
  vehicleId?: string;
  lastLocationUpdateTime?: number;
  position?: { lat: number; lon: number };
  orientation?: number;
  predicted: boolean;
  status?: string;
}

// ---------- Trip details ----------

export interface OBAStopTime {
  stopId: string;
  arrivalTime: number; // seconds since noon minus 12h (GTFS convention)
  departureTime: number;
  distanceAlongTrip?: number;
}

export interface OBATripDetails {
  tripId: string;
  serviceDate: number;
  frequency?: unknown;
  status?: OBATripStatus;
  schedule?: {
    timeZone: string;
    stopTimes: OBAStopTime[];
    previousTripId?: string;
    nextTripId?: string;
  };
  situationIds?: string[];
}

// ---------- Service alerts ----------

export interface OBASituation {
  id: string;
  summary?: { value: string; lang?: string };
  description?: { value: string; lang?: string };
  reason?: string;
  severity?: "unknown" | "veryMinor" | "minor" | "moderate" | "severe" | "verySevere";
  creationTime?: number;
  affects?: {
    agencies?: { agencyId: string }[];
    routes?: { routeId: string }[];
    stops?: { stopId: string }[];
  };
}

// ---------- App-level models (derived, not directly from OBA) ----------

/**
 * A single leg of a trip. In this hackathon build, we synthesize simple
 * one-transit-leg trips from real-time arrivals — a proper trip planner
 * (OpenTripPlanner) would replace this in production.
 */
export type LegKind = "walk" | "drive" | "wait" | "ride" | "transfer";

export interface TripLeg {
  kind: LegKind;
  durationSec: number;
  distanceMeters?: number;
  // For ride legs:
  routeId?: string;
  routeShortName?: string;
  tripId?: string;
  headsign?: string;
  boardStopId?: string;
  boardStopName?: string;
  alightStopId?: string;
  alightStopName?: string;
  stopsCount?: number;
  // Physical start/end of this leg (walk, drive, AND ride legs — used to
  // trace the full-journey overview line on the map).
  from?: LatLng;
  to?: LatLng;
  instructions?: string;
}

export interface TripPlan {
  id: string;
  origin: LatLng;
  destination: LatLng;
  destinationName: string;
  legs: TripLeg[];
  totalDurationSec: number;
  totalWalkingMeters: number;
  transferCount: number;
  arrivalTime: number; // epoch ms
  stressScore: number; // 0-100
  stressLabel: string;
  stressReason: string;
  confidence: Confidence;
  tags: Array<"stress-free" | "fastest" | "least-walking">;
}

export type Confidence = {
  level: "high" | "medium" | "low";
  score: number; // 0-100
  reasons: string[];
};

export interface RecentDestination {
  id: string;
  name: string;
  location: LatLng;
  visitedAt: number;
}

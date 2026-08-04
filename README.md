# TransitBuddy

An intelligent public-transit companion for the Pacific Northwest, built on
the [OneBusAway](https://onebusaway.org/) real-time transit API.

Unlike Google Maps or OneBusAway's own app, TransitBuddy is designed to reduce
anxiety for first-time riders. It doesn't just plan a route — it *guides* you
through every step, tells you which bus to board, when your stop is next, and
warns you if you're on the wrong bus or missed your stop.

## Features

| | |
| --- | --- |
| **Home** | Destination search, current location, nearby stops, recent destinations |
| **Route Results** | Multiple trip options tagged Stress-Free / Fastest / Least Walking |
| **Navigation** | Live map, live bus position, encoded polyline of the route, vertical progress timeline |
| **Ride Companion** | Large "one instruction at a time" cards guiding walk → wait → ride → alight |
| **Wrong Bus Detection** | Compares nearby vehicle positions to the selected route |
| **Missed Stop Detection** | Detects when the bus is past the alight point and reroutes |
| **Stress-Free Score** | Weighted algorithm across transfers, walking, wait, delay, and duration |
| **Confidence Indicator** | Based on real-time predictions, delays, transfer buffer |
| **Notifications** | Local phase-transition notifications ("Board now", "Your stop is next", "Exit here") |
| **Dark mode** | Automatic based on system theme |

## Tech Stack

- **Expo SDK 51** + **React Native 0.74** + **TypeScript**
- **expo-router** (file-based navigation, typed routes)
- **@tanstack/react-query** for API cache / polling
- **NativeWind 4** (Tailwind for React Native)
- **react-native-maps**
- **expo-location**, **expo-notifications**
- **@react-native-async-storage/async-storage** for recent destinations

## Setup

```bash
# 1. Install
npm install

# 2. Configure your OneBusAway API key
cp .env.example .env
# then edit .env and paste your key:
#   EXPO_PUBLIC_ONEBUSAWAY_API_KEY=your-key-here

# 3. Run
npx expo start
```

Get a free key from [pugetsound.onebusaway.org](https://pugetsound.onebusaway.org/)
(or any regional OBA server — set `EXPO_PUBLIC_ONEBUSAWAY_BASE_URL`
accordingly).

Press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR code
with the Expo Go app.

### Where the API key goes

The key is loaded in **exactly one place**, [src/api/config.ts](src/api/config.ts),
from these sources in order of priority:

1. `process.env.EXPO_PUBLIC_ONEBUSAWAY_API_KEY` (from `.env`) — **recommended**
2. `Constants.expoConfig.extra.onebusawayApiKey` (from `app.json`)
3. Empty (shows an in-app warning banner)

`src/api/client.ts` reads this constant and appends `?key=...` to every OBA
request. The key is never hardcoded anywhere else.

## Project Structure

```
transit-buddy/
├── app/                          # expo-router file-based routes
│   ├── _layout.tsx               # Root: providers, safe area, stack
│   ├── index.tsx                 # Home
│   ├── results.tsx               # Route Results
│   ├── navigate.tsx              # Navigation + Ride Companion (combined)
│   └── stop/[id].tsx             # Stop Detail (arrivals)
│
├── src/
│   ├── api/                      # OneBusAway REST client
│   │   ├── config.ts             # ← env var loading
│   │   ├── client.ts             # fetch wrapper + envelope unwrap
│   │   └── oneBusAway.ts         # typed endpoint functions
│   │
│   ├── components/
│   │   ├── ui/                   # Card, Button, Badge, StarRating,
│   │   │                         # ConfidenceBadge, RouteChip, Skeleton
│   │   ├── SearchBar.tsx
│   │   ├── StopListItem.tsx
│   │   ├── RouteOptionCard.tsx
│   │   ├── ProgressTimeline.tsx
│   │   ├── RideCompanionCard.tsx
│   │   ├── WarningBanner.tsx
│   │   └── ScreenHeader.tsx
│   │
│   ├── hooks/                    # React Query wrappers + expo-location
│   │   ├── useLocation.ts
│   │   ├── useNearbyStops.ts
│   │   ├── useArrivals.ts
│   │   ├── useVehicle.ts
│   │   ├── useStopSearch.ts
│   │   ├── useTripPlans.ts
│   │   └── useRecents.ts
│   │
│   ├── services/                 # Non-React business logic
│   │   ├── notifications.ts      # local notification service + copy library
│   │   ├── storage.ts            # AsyncStorage recents
│   │   ├── tripStore.ts          # cross-screen active-trip store
│   │   └── tripTracker.ts        # phase detection + wrong-bus + missed-stop
│   │
│   ├── utils/                    # Pure functions
│   │   ├── distance.ts           # haversine, formatDistance, walkingTimeSec
│   │   ├── time.ts               # formatClock, formatDuration, formatDeviation
│   │   ├── polyline.ts           # Google encoded-polyline decoder
│   │   ├── stressScore.ts        # Stress-Free algorithm + tagPlans
│   │   ├── confidence.ts         # Confidence indicator algorithm
│   │   └── planner.ts            # Single-leg trip planner from OBA arrivals
│   │
│   └── types/                    # OBA + app-level TS types
│
├── app.json                      # Expo config (permissions, plugins)
├── .env.example                  # ← copy to .env
└── package.json
```

## Architecture Notes

### API layer

Every OBA endpoint is wrapped in `src/api/oneBusAway.ts`. If your OBA server
uses non-standard paths, **only that file needs to change** — the rest of the
app depends on the typed function signatures, not on URLs.

The OBA REST envelope (`{ code, data: { entry|list, references } }`) is
unwrapped in the client so callers get clean payloads plus a `references`
object for resolving stop/route/trip IDs.

### Trip planning

`src/utils/planner.ts` builds simple `Walk → Wait → Ride → Walk` plans by:

1. Getting nearby boarding stops from `getNearbyStops(origin)`
2. For each stop, fetching real-time arrivals via `getArrivals(stopId)`
3. For each arrival, finding a downstream stop on the same route near the
   destination via `getRouteStops(routeId)`
4. Scoring the resulting candidate with the Stress-Free algorithm

Transfers are **not** modeled — a proper multi-modal planner
(OpenTripPlanner, Valhalla, or a routing server) would replace this module
without touching any downstream code. This is the single biggest place to
extend the app.

### Trip tracking

`src/services/tripTracker.ts` is a **pure function** that takes the current
`{ userLocation, vehicleLocation, tripStatus }` and returns a `TripState`
describing which phase of the trip the user is in and any warnings. Screens
subscribe by calling it on every GPS/vehicle update.

This structure means the tracker is fully unit-testable and the UI stays
purely reactive.

### Notifications

`src/services/notifications.ts` exports both a `notify()` scheduler and a
`notifCopy` object with all UI strings, so the same phrasing appears on-screen
and in system notifications.

## Where to Look if OBA Endpoints Differ

OneBusAway is deployed by different agencies with occasional variations. If
you hit a 404 or unexpected shape:

| Endpoint | File | Line-ish |
| --- | --- | --- |
| `stops-for-location` | [src/api/oneBusAway.ts](src/api/oneBusAway.ts) | `getNearbyStops`, `searchStops` |
| `arrivals-and-departures-for-stop` | [src/api/oneBusAway.ts](src/api/oneBusAway.ts) | `getArrivals` |
| `stops-for-route` | [src/api/oneBusAway.ts](src/api/oneBusAway.ts) | `getRouteStops` |
| `trip-details` | [src/api/oneBusAway.ts](src/api/oneBusAway.ts) | `getTripDetails` |
| `vehicle/{id}` | [src/api/oneBusAway.ts](src/api/oneBusAway.ts) | `getVehiclePosition` |
| `situations-for-agency` | [src/api/oneBusAway.ts](src/api/oneBusAway.ts) | `getServiceAlerts` (some servers omit this) |

Response TypeScript types live in [src/types/index.ts](src/types/index.ts) —
adjust these to match your server's actual shape.

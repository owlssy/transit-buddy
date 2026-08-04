/**
 * Trip planner.
 *
 * OBA has no trip-planner endpoint, so we synthesize one from the primitives
 * it does expose (stops-for-location, stops-for-route, arrivals). We produce
 * up to `MAX_PLANS` candidates in this priority order:
 *
 *   1. Direct routes — any single route serves both a stop near the origin
 *      and a stop near the destination, in the correct travel direction.
 *   2. One-transfer routes — a route from the origin meets a route to the
 *      destination at a common transfer stop.
 *   3. Walk-only — the destination is close enough to walk.
 *
 * Each candidate is scored with the Stress-Free algorithm and tagged with
 * whichever badges it earns (Stress-Free / Fastest / Least Walking).
 *
 * A real production planner (OpenTripPlanner) would replace THIS FILE and
 * nothing else in the app.
 */

import { getArrivals, getNearbyStops, getRouteStops } from "@/api/oneBusAway";
import type {
  LatLng,
  OBAArrivalDeparture,
  OBAStop,
  TripLeg,
  TripPlan,
} from "@/types";
import { computeConfidence } from "./confidence";
import { formatDistance, haversine, metersToFeet, walkingTimeSec } from "./distance";
import { computeStressScore, tagPlans } from "./stressScore";

// Progressive-search radii in meters. Suburban PNW (Sammamish, Issaquah)
// legitimately has no stops within 3 km, while downtown Seattle saturates at
// 400 m — so we start small and expand until we find something.
const SEARCH_RADII = [800, 2000, 5000, 8000];
const MAX_ORIGIN_STOPS = 8;
const MAX_DEST_STOPS = 8;
const MAX_TRANSFER_PAIRS = 40;
const MAX_PLANS = 6;
const BUS_SPEED_MPS = 10; // ~22 mph — rough average incl. stops
const DEST_WALK_MAX_M = 3200; // ~2 miles
// Any leg longer than this is rendered as a "drive" instead of "walk" —
// nobody's walking 3.6 miles to a bus stop, so we suggest they park & ride.
const WALK_TO_DRIVE_THRESHOLD_M = 800; // ~0.5 miles
const DRIVE_SPEED_MPS = 8.9; // ~20 mph urban avg

export interface PlanInputs {
  origin: LatLng;
  destination: LatLng;
  destinationName: string;
  originStops: OBAStop[]; // seed set (Home passes the nearby-stops result)
  now?: number;
}

// -------------------------------------------------------------------------
// Public entry
// -------------------------------------------------------------------------

export async function planTrips(input: PlanInputs): Promise<TripPlan[]> {
  const now = input.now ?? Date.now();

  // 1. Determine origin + destination stop candidates. If the seed set from
  //    the caller is empty (rural/suburban), fall back to our own progressive
  //    search around the origin. Same policy for the destination side.
  const originStopsRaw =
    input.originStops.length > 0
      ? input.originStops
      : (await progressiveStopSearch(input.origin)) ?? [];

  const originStops = sortByDistance(originStopsRaw, input.origin).slice(
    0,
    MAX_ORIGIN_STOPS,
  );

  const destStopsRaw = (await progressiveStopSearch(input.destination)) ?? [];
  const destStops = sortByDistance(destStopsRaw, input.destination).slice(
    0,
    MAX_DEST_STOPS,
  );

  const originRouteIds = uniqueRouteIds(originStops);
  const destRouteIds = uniqueRouteIds(destStops);

  const originStopsById = byId(originStops);
  const destStopsById = byId(destStops);

  // 2. Run every tier concurrently instead of stopping at the first one
  //    that finds anything. A direct or 1-transfer all-bus plan being
  //    *available* doesn't mean it's *good* — a route using Link light
  //    rail can easily be faster even with more transfers, but it would
  //    never get discovered (let alone compared) if the search
  //    short-circuited the moment a plain bus plan turned up. So we always
  //    also run 1-transfer, 2-transfer, and the extended N-transfer BFS
  //    (the one that's actually able to find Link as a connecting route),
  //    and let the stress/duration scoring below pick the winner.
  const tierArgs = { originRouteIds, destRouteIds, originStopsById, destStopsById, input, now };
  const [directPlans, transferPlans, twoTransferPlans, extendedPlans] = await Promise.all([
    planDirect({
      routeIds: intersect(originRouteIds, destRouteIds),
      originStopsById,
      destStopsById,
      input,
      now,
    }),
    planOneTransfer(tierArgs),
    planTwoTransfer(tierArgs),
    planExtendedTransfer(tierArgs),
  ]);

  const all = [...directPlans, ...transferPlans, ...twoTransferPlans, ...extendedPlans];

  // 3. Final fallback — no transit found at all.
  if (all.length === 0) {
    return [buildWalkOnlyPlan(input, now)];
  }

  // De-dupe (tiers can independently rediscover the same ride — e.g. the
  // extended BFS re-finding a plain 1-transfer plan), then sort: stress
  // desc, then duration asc, keep top MAX_PLANS.
  const deduped = [...new Map(all.map((p) => [p.id, p])).values()];
  const sorted = deduped
    .sort((a, b) => {
      if (b.stressScore !== a.stressScore) return b.stressScore - a.stressScore;
      return a.totalDurationSec - b.totalDurationSec;
    })
    .slice(0, MAX_PLANS);

  return tagPlans(sorted);
}

// -------------------------------------------------------------------------
// Direct routes
// -------------------------------------------------------------------------

interface DirectArgs {
  routeIds: string[];
  originStopsById: Map<string, OBAStop>;
  destStopsById: Map<string, OBAStop>;
  input: PlanInputs;
  now: number;
}

async function planDirect(args: DirectArgs): Promise<TripPlan[]> {
  const plans: TripPlan[] = [];

  for (const routeId of args.routeIds) {
    const routeInfo = await getRouteStopsCached(routeId);
    if (!routeInfo) continue;

    // Find the best (origin, destination) stop pair that's on this route.
    // We used to require oIdx < dIdx (travel direction), but OBA's stopIds
    // aren't reliably direction-ordered — that check was excluding correct
    // direct plans. Use index-gap only for the display "N stops away" count.
    let bestPair: {
      board: OBAStop;
      alight: OBAStop;
      stopsCount: number;
    } | null = null;

    for (const [oId, oStop] of args.originStopsById) {
      const oIdx = routeInfo.orderedIds.indexOf(oId);
      if (oIdx < 0) continue;

      for (const [dId, dStop] of args.destStopsById) {
        if (dId === oId) continue;
        const dIdx = routeInfo.orderedIds.indexOf(dId);
        if (dIdx < 0) continue;

        const stopsCount = Math.max(1, Math.abs(dIdx - oIdx));
        if (!bestPair || stopsCount < bestPair.stopsCount) {
          bestPair = { board: oStop, alight: dStop, stopsCount };
        }
      }
    }

    if (!bestPair) continue;

    // Fetch a real arrival to time the ride leg.
    const arr = await findArrivalForRoute(bestPair.board.id, routeId);
    const plan = buildDirectPlan({
      routeId,
      routeShortName: arr?.routeShortName ?? shortNameFromRouteId(routeId, routeInfo),
      headsign: arr?.tripHeadsign,
      tripId: arr?.tripId,
      boardStop: bestPair.board,
      alightStop: bestPair.alight,
      stopsCount: bestPair.stopsCount,
      boardTime: arr ? arrivalBoardTime(arr) : args.now + 5 * 60_000,
      isPredicted: !!arr?.predicted,
      speedMps: speedForRouteType(routeInfo.type),
      input: args.input,
      now: args.now,
    });
    if (plan) plans.push(plan);
  }

  return plans;
}

// -------------------------------------------------------------------------
// One-transfer routes
// -------------------------------------------------------------------------

interface TransferArgs {
  originRouteIds: string[];
  destRouteIds: string[];
  originStopsById: Map<string, OBAStop>;
  destStopsById: Map<string, OBAStop>;
  input: PlanInputs;
  now: number;
}

async function planOneTransfer(args: TransferArgs): Promise<TripPlan[]> {
  // Pre-fetch route stops for both sides in parallel.
  const [originRoutes, destRoutes] = await Promise.all([
    Promise.all(args.originRouteIds.map(getRouteStopsCached)),
    Promise.all(args.destRouteIds.map(getRouteStopsCached)),
  ]);

  const plans: TripPlan[] = [];
  let pairsChecked = 0;

  for (const or of originRoutes) {
    if (!or) continue;
    for (const dr of destRoutes) {
      if (!dr) continue;
      if (or.routeId === dr.routeId) continue; // handled by "direct" path
      if (pairsChecked++ > MAX_TRANSFER_PAIRS) break;

      // Find any stop served by both routes. OBA's `stopIds` isn't guaranteed
      // to be direction-ordered (it depends on the deployment), so we don't
      // try to enforce "downstream on leg 1, upstream on leg 2" — that check
      // was silently excluding valid transfers like Bellevue Transit Center.
      // We rank candidates by how tight the transfer is geographically instead.
      const commonStopIds = or.orderedIds.filter((id) => dr.orderedIds.includes(id));
      if (commonStopIds.length === 0) continue;

      const boardStop = closestStopOnRoute(args.input.origin, or);
      const alightStop = closestStopOnRoute(args.input.destination, dr);
      if (!boardStop || !alightStop) continue;

      let bestTransfer: {
        stop: OBAStop;
        leg1Stops: number;
        leg2Stops: number;
      } | null = null;

      for (const tid of commonStopIds) {
        if (tid === boardStop.id || tid === alightStop.id) continue;
        const tStop = or.stopsById.get(tid) ?? dr.stopsById.get(tid);
        if (!tStop) continue;

        // Approximate stops-count via index distance (imperfect when
        // stopIds isn't ordered, but only used to display "N stops away").
        const boardIdx = or.orderedIds.indexOf(boardStop.id);
        const alightIdx = dr.orderedIds.indexOf(alightStop.id);
        const tOnOrigin = or.orderedIds.indexOf(tid);
        const tOnDest = dr.orderedIds.indexOf(tid);
        const leg1 = Math.max(1, Math.abs(tOnOrigin - boardIdx));
        const leg2 = Math.max(1, Math.abs(alightIdx - tOnDest));

        const scoreThis = leg1 + leg2;
        const scoreBest = bestTransfer
          ? bestTransfer.leg1Stops + bestTransfer.leg2Stops
          : Infinity;
        if (scoreThis < scoreBest) {
          bestTransfer = { stop: tStop, leg1Stops: leg1, leg2Stops: leg2 };
        }
      }

      if (!bestTransfer) continue;

      const arr1 = await findArrivalForRoute(boardStop.id, or.routeId);
      const plan = buildTransferPlan({
        input: args.input,
        now: args.now,
        route1: {
          routeId: or.routeId,
          routeShortName:
            arr1?.routeShortName ?? shortNameFromRouteId(or.routeId, or),
          headsign: arr1?.tripHeadsign,
          tripId: arr1?.tripId,
          boardStop,
          alightStop: bestTransfer.stop,
          stopsCount: bestTransfer.leg1Stops,
          boardTime: arr1 ? arrivalBoardTime(arr1) : args.now + 5 * 60_000,
          isPredicted: !!arr1?.predicted,
          speedMps: speedForRouteType(or.type),
        },
        route2: {
          routeId: dr.routeId,
          routeShortName: shortNameFromRouteId(dr.routeId, dr),
          boardStop: bestTransfer.stop,
          alightStop,
          stopsCount: bestTransfer.leg2Stops,
          speedMps: speedForRouteType(dr.type),
        },
      });
      if (plan) plans.push(plan);
    }
    if (pairsChecked > MAX_TRANSFER_PAIRS) break;
  }

  return plans;
}

// -------------------------------------------------------------------------
// Two-transfer routes
// -------------------------------------------------------------------------

async function planTwoTransfer(args: TransferArgs): Promise<TripPlan[]> {
  const [originRoutes, destRoutes] = await Promise.all([
    Promise.all(args.originRouteIds.map(getRouteStopsCached)),
    Promise.all(args.destRouteIds.map(getRouteStopsCached)),
  ]);

  const plans: TripPlan[] = [];

  for (const or of originRoutes) {
    if (!or) continue;
    const boardStop = closestStopOnRoute(args.input.origin, or);
    if (!boardStop) continue;

    // From origin route: which OTHER routes can we transfer to, and at which stop?
    // (Middle-route candidates reachable via 1 transfer from origin.)
    const midFromOrigin = new Map<string, OBAStop>();
    for (const s of or.stopsById.values()) {
      for (const rid of s.routeIds ?? []) {
        if (rid === or.routeId) continue;
        if (args.originRouteIds.includes(rid)) continue;
        if (args.destRouteIds.includes(rid)) continue;
        if (!midFromOrigin.has(rid)) midFromOrigin.set(rid, s);
      }
    }

    for (const dr of destRoutes) {
      if (!dr) continue;
      if (dr.routeId === or.routeId) continue;
      const alightStop = closestStopOnRoute(args.input.destination, dr);
      if (!alightStop) continue;

      // Middle-route candidates reachable via 1 transfer from destination.
      const midFromDest = new Map<string, OBAStop>();
      for (const s of dr.stopsById.values()) {
        for (const rid of s.routeIds ?? []) {
          if (rid === dr.routeId) continue;
          if (args.originRouteIds.includes(rid)) continue;
          if (args.destRouteIds.includes(rid)) continue;
          if (!midFromDest.has(rid)) midFromDest.set(rid, s);
        }
      }

      // Middle routes reachable from BOTH sides = valid 2-transfer paths.
      for (const [midRouteId, transfer1Stop] of midFromOrigin) {
        const transfer2Stop = midFromDest.get(midRouteId);
        if (!transfer2Stop) continue;
        if (transfer1Stop.id === transfer2Stop.id) continue; // would be 1-transfer

        const arr1 = await findArrivalForRoute(boardStop.id, or.routeId);
        const midInfo = await getRouteStopsCached(midRouteId);
        const midShortName = shortNameFromRouteId(midRouteId, midInfo);

        const plan = buildTwoTransferPlan({
          input: args.input,
          now: args.now,
          leg1: {
            routeId: or.routeId,
            routeShortName:
              arr1?.routeShortName ?? shortNameFromRouteId(or.routeId, or),
            headsign: arr1?.tripHeadsign,
            tripId: arr1?.tripId,
            boardStop,
            alightStop: transfer1Stop,
            boardTime: arr1 ? arrivalBoardTime(arr1) : args.now + 5 * 60_000,
            isPredicted: !!arr1?.predicted,
            speedMps: speedForRouteType(or.type),
          },
          leg2: {
            routeId: midRouteId,
            routeShortName: midShortName,
            boardStop: transfer1Stop,
            alightStop: transfer2Stop,
            speedMps: speedForRouteType(midInfo?.type),
          },
          leg3: {
            routeId: dr.routeId,
            routeShortName: shortNameFromRouteId(dr.routeId, dr),
            speedMps: speedForRouteType(dr.type),
            boardStop: transfer2Stop,
            alightStop,
          },
        });
        if (plan) plans.push(plan);
        if (plans.length >= MAX_PLANS) break;
      }
      if (plans.length >= MAX_PLANS) break;
    }
    if (plans.length >= MAX_PLANS) break;
  }

  return plans;
}

// -------------------------------------------------------------------------
// Extended transfer search (3+) — no hard cap on transfer count
// -------------------------------------------------------------------------

// Some trips (e.g. deep suburb → SEA Airport) genuinely need 3+ transfers.
// Rather than hand-write a planThreeTransfer/planFourTransfer/... for every
// depth, this does a breadth-first search over the "route graph" (two
// routes are connected if they share a stop), expanding one transfer at a
// time until it reaches a route that serves the destination. Bounded by
// MAX_EXTENDED_TRANSFERS (search depth) and MAX_ROUTES_EXPLORED (network
// calls) so a dead-end area can't hang the planner.
const MAX_EXTENDED_TRANSFERS = 5;
const MAX_ROUTES_EXPLORED = 60;

interface ChainLeg {
  routeId: string;
  routeShortName: string;
  boardStop: OBAStop;
  alightStop: OBAStop;
  speedMps: number;
}

interface ExtendedFrontierNode {
  routeInfo: RouteInfo;
  boardStop: OBAStop;
  chain: ChainLeg[]; // completed legs strictly before this route
}

async function planExtendedTransfer(args: TransferArgs): Promise<TripPlan[]> {
  const visited = new Set<string>();
  let frontier: ExtendedFrontierNode[] = [];
  let explored = 0;

  for (const rid of args.originRouteIds) {
    if (explored >= MAX_ROUTES_EXPLORED) break;
    explored++;
    const info = await getRouteStopsCached(rid);
    if (!info) continue;
    const boardStop = closestStopOnRoute(args.input.origin, info);
    if (!boardStop) continue;
    visited.add(rid);
    frontier.push({ routeInfo: info, boardStop, chain: [] });
  }

  const plans: TripPlan[] = [];

  for (
    let depth = 0;
    depth < MAX_EXTENDED_TRANSFERS && frontier.length > 0 && plans.length === 0;
    depth++
  ) {
    const nextFrontier: ExtendedFrontierNode[] = [];

    for (const node of frontier) {
      const alightStop = closestStopOnRoute(args.input.destination, node.routeInfo);
      if (alightStop) {
        const chain: ChainLeg[] = [
          ...node.chain,
          {
            routeId: node.routeInfo.routeId,
            routeShortName: shortNameFromRouteId(node.routeInfo.routeId, node.routeInfo),
            boardStop: node.boardStop,
            alightStop,
            speedMps: speedForRouteType(node.routeInfo.type),
          },
        ];
        const plan = await buildChainPlan(chain, args.input, args.now);
        if (plan) plans.push(plan);
        continue; // this route reaches the destination — no need to expand further
      }

      if (explored >= MAX_ROUTES_EXPLORED) continue;

      // Candidate next routes: anything sharing a stop with this route that
      // we haven't already visited.
      const candidates = new Map<string, OBAStop>();
      for (const s of node.routeInfo.stopsById.values()) {
        for (const rid of s.routeIds ?? []) {
          if (rid === node.routeInfo.routeId || visited.has(rid)) continue;
          if (!candidates.has(rid)) candidates.set(rid, s);
        }
      }

      for (const [rid, transferStop] of candidates) {
        if (explored >= MAX_ROUTES_EXPLORED) break;
        visited.add(rid);
        explored++;
        const info = await getRouteStopsCached(rid);
        if (!info) continue;
        nextFrontier.push({
          routeInfo: info,
          boardStop: transferStop,
          chain: [
            ...node.chain,
            {
              routeId: node.routeInfo.routeId,
              routeShortName: shortNameFromRouteId(node.routeInfo.routeId, node.routeInfo),
              boardStop: node.boardStop,
              alightStop: transferStop,
              speedMps: speedForRouteType(node.routeInfo.type),
            },
          ],
        });
      }
    }

    frontier = nextFrontier;
  }

  return plans.slice(0, MAX_PLANS);
}

/** Builds a plan from any number of chained route legs (1 = direct, N = N-1 transfers). */
async function buildChainPlan(
  legs: ChainLeg[],
  input: PlanInputs,
  now: number,
): Promise<TripPlan | null> {
  if (legs.length === 0) return null;
  const first = legs[0];
  const last = legs[legs.length - 1];

  const boardLatLng: LatLng = { latitude: first.boardStop.lat, longitude: first.boardStop.lon };
  const alightLatLng: LatLng = { latitude: last.alightStop.lat, longitude: last.alightStop.lon };

  const walkToStopM = haversine(input.origin, boardLatLng);
  const walkFromStopM = haversine(alightLatLng, input.destination);
  if (walkFromStopM > DEST_WALK_MAX_M) return null;

  const walkToStopSec = walkingTimeSec(walkToStopM);
  const walkFromStopSec = walkingTimeSec(walkFromStopM);

  const arr1 = await findArrivalForRoute(first.boardStop.id, first.routeId);
  const boardTime1 = arr1 ? arrivalBoardTime(arr1) : now + 5 * 60_000;
  const wait1Sec = Math.max(0, Math.round((boardTime1 - now) / 1000) - walkToStopSec);
  const transferSec = 300;
  const laterWaitSec = 300;

  const legFirst = makeWalkLeg(
    input.origin, boardLatLng, walkToStopM, walkToStopSec,
    `Walk ${formatDistance(walkToStopM)} to ${first.boardStop.name}`,
  );
  const legLast = makeWalkLeg(
    alightLatLng, input.destination, walkFromStopM, walkFromStopSec,
    `Walk ${formatDistance(walkFromStopM)} to ${input.destinationName}`,
  );

  const tripLegs: TripLeg[] = [legFirst];
  let totalSec = legFirst.durationSec;
  let totalWaitSec = 0;

  legs.forEach((leg, i) => {
    const boardLL: LatLng = { latitude: leg.boardStop.lat, longitude: leg.boardStop.lon };
    const alightLL: LatLng = { latitude: leg.alightStop.lat, longitude: leg.alightStop.lon };
    const rideM = haversine(boardLL, alightLL);
    const rideSec = Math.max(60, Math.round(rideM / leg.speedMps));
    const waitSec = i === 0 ? wait1Sec : laterWaitSec;
    totalWaitSec += waitSec;
    totalSec += waitSec + rideSec;

    tripLegs.push(makeWaitLeg(waitSec, leg.boardStop, leg.routeShortName));
    tripLegs.push(
      makeRideLeg({
        routeId: leg.routeId,
        routeShortName: leg.routeShortName,
        tripId: i === 0 ? arr1?.tripId : undefined,
        headsign: i === 0 ? arr1?.tripHeadsign : undefined,
        boardStop: leg.boardStop,
        alightStop: leg.alightStop,
        stopsCount: Math.max(2, Math.round(rideM / 400)),
        durationSec: rideSec,
        rideM,
      }),
    );

    if (i < legs.length - 1) {
      tripLegs.push({
        kind: "transfer",
        durationSec: transferSec,
        instructions: `Transfer at ${leg.alightStop.name}`,
        boardStopName: leg.alightStop.name,
      });
      totalSec += transferSec;
    }
  });

  tripLegs.push(legLast);
  totalSec += legLast.durationSec;

  return finalizePlan({
    input,
    now,
    legs: tripLegs,
    transferCount: legs.length - 1,
    walkingMeters: walkToStopM + walkFromStopM,
    waitSec: totalWaitSec,
    totalSec,
    predicted: !!arr1?.predicted,
  });
}

// -------------------------------------------------------------------------
// Plan builders
// -------------------------------------------------------------------------

interface DirectPlanArgs {
  routeId: string;
  routeShortName: string;
  headsign?: string;
  tripId?: string;
  boardStop: OBAStop;
  alightStop: OBAStop;
  stopsCount: number;
  boardTime: number;
  isPredicted: boolean;
  speedMps: number;
  input: PlanInputs;
  now: number;
}

function buildDirectPlan(a: DirectPlanArgs): TripPlan | null {
  const boardLatLng: LatLng = { latitude: a.boardStop.lat, longitude: a.boardStop.lon };
  const alightLatLng: LatLng = { latitude: a.alightStop.lat, longitude: a.alightStop.lon };

  const walkToStopM = haversine(a.input.origin, boardLatLng);
  const walkFromStopM = haversine(alightLatLng, a.input.destination);
  if (walkFromStopM > DEST_WALK_MAX_M) return null;

  const walkToStopSec = walkingTimeSec(walkToStopM);
  const walkFromStopSec = walkingTimeSec(walkFromStopM);

  const waitSec = Math.max(0, Math.round((a.boardTime - a.now) / 1000) - walkToStopSec);
  const rideM = haversine(boardLatLng, alightLatLng);
  const rideSec = Math.max(60, Math.round(rideM / a.speedMps));

  const leg0 = makeWalkLeg(a.input.origin, boardLatLng, walkToStopM, walkToStopSec, `Walk ${formatDistance(walkToStopM)} to ${a.boardStop.name}`);
  const legLast = makeWalkLeg(alightLatLng, a.input.destination, walkFromStopM, walkFromStopSec, `Walk ${formatDistance(walkFromStopM)} to ${a.input.destinationName}`);
  const totalSec = leg0.durationSec + waitSec + rideSec + legLast.durationSec;

  const legs: TripLeg[] = [
    leg0,
    makeWaitLeg(waitSec, a.boardStop, a.routeShortName),
    makeRideLeg({
      routeId: a.routeId,
      routeShortName: a.routeShortName,
      tripId: a.tripId,
      headsign: a.headsign,
      boardStop: a.boardStop,
      alightStop: a.alightStop,
      stopsCount: a.stopsCount,
      durationSec: rideSec,
      rideM,
    }),
    legLast,
  ];

  return finalizePlan({
    input: a.input,
    now: a.now,
    legs,
    transferCount: 0,
    walkingMeters: walkToStopM + walkFromStopM,
    waitSec,
    totalSec,
    predicted: a.isPredicted,
  });
}

interface TransferPlanArgs {
  input: PlanInputs;
  now: number;
  route1: {
    routeId: string;
    routeShortName: string;
    headsign?: string;
    tripId?: string;
    boardStop: OBAStop;
    alightStop: OBAStop;
    stopsCount: number;
    boardTime: number;
    isPredicted: boolean;
    speedMps: number;
  };
  route2: {
    routeId: string;
    routeShortName: string;
    boardStop: OBAStop; // same as route1.alightStop
    alightStop: OBAStop;
    stopsCount: number;
    speedMps: number;
  };
}

function buildTransferPlan(a: TransferPlanArgs): TripPlan | null {
  const board1: LatLng = { latitude: a.route1.boardStop.lat, longitude: a.route1.boardStop.lon };
  const transfer: LatLng = { latitude: a.route1.alightStop.lat, longitude: a.route1.alightStop.lon };
  const alight2: LatLng = { latitude: a.route2.alightStop.lat, longitude: a.route2.alightStop.lon };

  const walkToStopM = haversine(a.input.origin, board1);
  const walkFromStopM = haversine(alight2, a.input.destination);
  if (walkFromStopM > DEST_WALK_MAX_M) return null;

  const walkToStopSec = walkingTimeSec(walkToStopM);
  const walkFromStopSec = walkingTimeSec(walkFromStopM);

  const wait1Sec = Math.max(0, Math.round((a.route1.boardTime - a.now) / 1000) - walkToStopSec);
  const ride1M = haversine(board1, transfer);
  const ride1Sec = Math.max(60, Math.round(ride1M / a.route1.speedMps));

  // Transfer buffer: assume 5 min for cross-platform / cross-street.
  const transferSec = 300;
  const wait2Sec = 240; // typical next-bus wait, roughly

  const ride2M = haversine(transfer, alight2);
  const ride2Sec = Math.max(60, Math.round(ride2M / a.route2.speedMps));

  const leg0 = makeWalkLeg(a.input.origin, board1, walkToStopM, walkToStopSec, `Walk ${formatDistance(walkToStopM)} to ${a.route1.boardStop.name}`);
  const legLast = makeWalkLeg(alight2, a.input.destination, walkFromStopM, walkFromStopSec, `Walk ${formatDistance(walkFromStopM)} to ${a.input.destinationName}`);
  const totalSec =
    leg0.durationSec + wait1Sec + ride1Sec + transferSec + wait2Sec + ride2Sec + legLast.durationSec;

  const legs: TripLeg[] = [
    leg0,
    makeWaitLeg(wait1Sec, a.route1.boardStop, a.route1.routeShortName),
    makeRideLeg({
      routeId: a.route1.routeId,
      routeShortName: a.route1.routeShortName,
      tripId: a.route1.tripId,
      headsign: a.route1.headsign,
      boardStop: a.route1.boardStop,
      alightStop: a.route1.alightStop,
      stopsCount: a.route1.stopsCount,
      durationSec: ride1Sec,
      rideM: ride1M,
    }),
    {
      kind: "transfer",
      durationSec: transferSec,
      instructions: `Transfer at ${a.route1.alightStop.name}`,
      boardStopName: a.route1.alightStop.name,
    },
    makeWaitLeg(wait2Sec, a.route2.boardStop, a.route2.routeShortName),
    makeRideLeg({
      routeId: a.route2.routeId,
      routeShortName: a.route2.routeShortName,
      boardStop: a.route2.boardStop,
      alightStop: a.route2.alightStop,
      stopsCount: a.route2.stopsCount,
      durationSec: ride2Sec,
      rideM: ride2M,
    }),
    legLast,
  ];

  return finalizePlan({
    input: a.input,
    now: a.now,
    legs,
    transferCount: 1,
    walkingMeters: walkToStopM + walkFromStopM,
    waitSec: wait1Sec + wait2Sec,
    totalSec,
    predicted: a.route1.isPredicted,
  });
}

interface TwoTransferPlanArgs {
  input: PlanInputs;
  now: number;
  leg1: {
    routeId: string;
    routeShortName: string;
    headsign?: string;
    tripId?: string;
    boardStop: OBAStop;
    alightStop: OBAStop; // = transfer1
    boardTime: number;
    isPredicted: boolean;
    speedMps: number;
  };
  leg2: {
    routeId: string;
    routeShortName: string;
    boardStop: OBAStop; // = transfer1
    alightStop: OBAStop; // = transfer2
    speedMps: number;
  };
  leg3: {
    routeId: string;
    routeShortName: string;
    boardStop: OBAStop; // = transfer2
    alightStop: OBAStop;
    speedMps: number;
  };
}

function buildTwoTransferPlan(a: TwoTransferPlanArgs): TripPlan | null {
  const board1: LatLng = { latitude: a.leg1.boardStop.lat, longitude: a.leg1.boardStop.lon };
  const transfer1: LatLng = { latitude: a.leg1.alightStop.lat, longitude: a.leg1.alightStop.lon };
  const transfer2: LatLng = { latitude: a.leg2.alightStop.lat, longitude: a.leg2.alightStop.lon };
  const alight3: LatLng = { latitude: a.leg3.alightStop.lat, longitude: a.leg3.alightStop.lon };

  const walkToStopM = haversine(a.input.origin, board1);
  const walkFromStopM = haversine(alight3, a.input.destination);
  if (walkFromStopM > DEST_WALK_MAX_M) return null;

  const walkToStopSec = walkingTimeSec(walkToStopM);
  const walkFromStopSec = walkingTimeSec(walkFromStopM);

  const wait1Sec = Math.max(0, Math.round((a.leg1.boardTime - a.now) / 1000) - walkToStopSec);
  const transferSec = 300;
  const wait2Sec = 300;
  const wait3Sec = 300;

  const ride1M = haversine(board1, transfer1);
  const ride1Sec = Math.max(60, Math.round(ride1M / a.leg1.speedMps));
  const ride2M = haversine(transfer1, transfer2);
  const ride2Sec = Math.max(60, Math.round(ride2M / a.leg2.speedMps));
  const ride3M = haversine(transfer2, alight3);
  const ride3Sec = Math.max(60, Math.round(ride3M / a.leg3.speedMps));

  const legFirst = makeWalkLeg(
    a.input.origin, board1, walkToStopM, walkToStopSec,
    `Walk ${formatDistance(walkToStopM)} to ${a.leg1.boardStop.name}`,
  );
  const legLast = makeWalkLeg(
    alight3, a.input.destination, walkFromStopM, walkFromStopSec,
    `Walk ${formatDistance(walkFromStopM)} to ${a.input.destinationName}`,
  );

  const totalSec =
    legFirst.durationSec +
    wait1Sec + ride1Sec +
    transferSec + wait2Sec + ride2Sec +
    transferSec + wait3Sec + ride3Sec +
    legLast.durationSec;

  // Estimate stops-count between transfers/alights when we don't have route info.
  const stopCountApprox = (m: number) => Math.max(2, Math.round(m / 400));

  const legs: TripLeg[] = [
    legFirst,
    makeWaitLeg(wait1Sec, a.leg1.boardStop, a.leg1.routeShortName),
    makeRideLeg({
      routeId: a.leg1.routeId, routeShortName: a.leg1.routeShortName,
      tripId: a.leg1.tripId, headsign: a.leg1.headsign,
      boardStop: a.leg1.boardStop, alightStop: a.leg1.alightStop,
      stopsCount: stopCountApprox(ride1M),
      durationSec: ride1Sec, rideM: ride1M,
    }),
    { kind: "transfer", durationSec: transferSec, instructions: `Transfer at ${a.leg1.alightStop.name}`, boardStopName: a.leg1.alightStop.name },
    makeWaitLeg(wait2Sec, a.leg2.boardStop, a.leg2.routeShortName),
    makeRideLeg({
      routeId: a.leg2.routeId, routeShortName: a.leg2.routeShortName,
      boardStop: a.leg2.boardStop, alightStop: a.leg2.alightStop,
      stopsCount: stopCountApprox(ride2M),
      durationSec: ride2Sec, rideM: ride2M,
    }),
    { kind: "transfer", durationSec: transferSec, instructions: `Transfer at ${a.leg2.alightStop.name}`, boardStopName: a.leg2.alightStop.name },
    makeWaitLeg(wait3Sec, a.leg3.boardStop, a.leg3.routeShortName),
    makeRideLeg({
      routeId: a.leg3.routeId, routeShortName: a.leg3.routeShortName,
      boardStop: a.leg3.boardStop, alightStop: a.leg3.alightStop,
      stopsCount: stopCountApprox(ride3M),
      durationSec: ride3Sec, rideM: ride3M,
    }),
    legLast,
  ];

  return finalizePlan({
    input: a.input,
    now: a.now,
    legs,
    transferCount: 2,
    walkingMeters: walkToStopM + walkFromStopM,
    waitSec: wait1Sec + wait2Sec + wait3Sec,
    totalSec,
    predicted: a.leg1.isPredicted,
  });
}

// -------------------------------------------------------------------------
// Leg factories
// -------------------------------------------------------------------------

function makeWalkLeg(
  from: LatLng,
  to: LatLng,
  meters: number,
  sec: number,
  instructions: string,
): TripLeg {
  // Auto-promote long walks to a drive leg. A 3-mile walk isn't a plan —
  // it's a failure mode. If the user is that far from transit, tell them.
  if (meters > WALK_TO_DRIVE_THRESHOLD_M) {
    const driveSec = Math.max(60, Math.round(meters / DRIVE_SPEED_MPS));
    const cleanedInstructions = instructions.replace(/^Walk /i, "Drive or catch a ride ");
    return {
      kind: "drive",
      from,
      to,
      distanceMeters: meters,
      durationSec: driveSec,
      instructions: cleanedInstructions,
    };
  }
  return { kind: "walk", from, to, distanceMeters: meters, durationSec: sec, instructions };
}

function makeWaitLeg(sec: number, stop: OBAStop, routeShortName: string): TripLeg {
  return {
    kind: "wait",
    durationSec: sec,
    routeShortName,
    boardStopId: stop.id,
    boardStopName: stop.name,
    instructions: `Wait for Route ${routeShortName}`,
  };
}

function makeRideLeg(args: {
  routeId: string;
  routeShortName: string;
  tripId?: string;
  headsign?: string;
  boardStop: OBAStop;
  alightStop: OBAStop;
  stopsCount: number;
  durationSec: number;
  rideM: number;
}): TripLeg {
  return {
    kind: "ride",
    durationSec: args.durationSec,
    distanceMeters: args.rideM,
    routeId: args.routeId,
    routeShortName: args.routeShortName,
    tripId: args.tripId,
    headsign: args.headsign,
    boardStopId: args.boardStop.id,
    boardStopName: args.boardStop.name,
    alightStopId: args.alightStop.id,
    alightStopName: args.alightStop.name,
    stopsCount: args.stopsCount,
    // Board/alight coords — used to draw the full-journey overview line on
    // the map (the `from`/`to` fields aren't walk-only despite the comment
    // on TripLeg; every leg kind that has a physical start/end sets them).
    from: { latitude: args.boardStop.lat, longitude: args.boardStop.lon },
    to: { latitude: args.alightStop.lat, longitude: args.alightStop.lon },
  };
}

// -------------------------------------------------------------------------
// Scoring / finalization
// -------------------------------------------------------------------------

interface FinalizeArgs {
  input: PlanInputs;
  now: number;
  legs: TripLeg[];
  transferCount: number;
  walkingMeters: number;
  waitSec: number;
  totalSec: number;
  predicted: boolean;
}

function finalizePlan(a: FinalizeArgs): TripPlan {
  const stress = computeStressScore({
    transferCount: a.transferCount,
    walkingMeters: a.walkingMeters,
    waitingSec: a.waitSec,
    delaySec: 0,
    totalDurationSec: a.totalSec,
  });

  const confidence = computeConfidence({
    hasRealtimeArrival: a.predicted,
    scheduleDeviationSec: 0,
    transferCount: a.transferCount,
    minTransferBufferSec: a.transferCount > 0 ? 300 : undefined,
  });

  const arrivalTime = a.now + a.totalSec * 1000;
  const id = a.legs
    .filter((l) => l.kind === "ride")
    .map((l) => `${l.routeId}@${l.boardStopId}->${l.alightStopId}`)
    .join("|") || `walk-${a.now}`;

  return {
    id,
    origin: a.input.origin,
    destination: a.input.destination,
    destinationName: a.input.destinationName,
    legs: a.legs,
    totalDurationSec: a.totalSec,
    totalWalkingMeters: a.walkingMeters,
    transferCount: a.transferCount,
    arrivalTime,
    stressScore: stress.score,
    stressLabel: stress.label,
    stressReason: stress.reason,
    confidence,
    tags: [],
  };
}

function buildWalkOnlyPlan(input: PlanInputs, now: number): TripPlan {
  const meters = haversine(input.origin, input.destination);
  // The leg factory auto-promotes to drive when > 0.5 mi — so a 12-mile trip
  // renders as "Drive 12 mi" instead of "Walk 12 mi". If it's still a walk,
  // we present it plainly. If it becomes a drive, we call out the failure.
  const leg = makeWalkLeg(
    input.origin,
    input.destination,
    meters,
    walkingTimeSec(meters),
    `${meters > 800 ? "Drive or catch a ride" : "Walk"} ${formatDistance(meters)} to ${input.destinationName}`,
  );
  const isDrive = leg.kind === "drive";

  const stress = computeStressScore({
    transferCount: 0,
    walkingMeters: isDrive ? 0 : meters,
    waitingSec: 0,
    delaySec: 0,
    totalDurationSec: leg.durationSec,
  });

  return {
    id: `${isDrive ? "drive" : "walk"}-only-${now}`,
    origin: input.origin,
    destination: input.destination,
    destinationName: input.destinationName,
    legs: [leg],
    totalDurationSec: leg.durationSec,
    totalWalkingMeters: isDrive ? 0 : meters,
    transferCount: 0,
    arrivalTime: now + leg.durationSec * 1000,
    stressScore: isDrive ? 30 : stress.score,
    stressLabel: isDrive ? "No transit" : stress.label,
    stressReason: isDrive
      ? "No transit path found — you'll need to drive or use a rideshare."
      : "No transit needed — it's walkable.",
    confidence: {
      level: isDrive ? "low" : "high",
      score: isDrive ? 20 : 90,
      reasons: [
        isDrive
          ? "OneBusAway couldn't wire this into a 1- or 2-transfer transit trip"
          : "Walking only",
      ],
    },
    tags: [],
  };
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

type RouteInfo = {
  routeId: string;
  orderedIds: string[];
  stopsById: Map<string, OBAStop>;
  shortName?: string;
  // GTFS route_type: 0=tram/light rail, 1=subway, 2=rail, 3=bus, 4=ferry.
  // Needed so ride-time math doesn't assume bus speed for Link light rail
  // (agency 40) — see speedForRouteType() below.
  type?: number;
};

const routeStopsCache = new Map<string, RouteInfo | null>();

async function getRouteStopsCached(routeId: string): Promise<RouteInfo | null> {
  if (routeStopsCache.has(routeId)) return routeStopsCache.get(routeId)!;
  try {
    const res = await getRouteStops(routeId);
    const stops = res.references.stops ?? [];
    const routes = res.references.routes ?? [];
    const matchedRoute = routes.find((r) => r.id === routeId);
    const info: RouteInfo = {
      routeId,
      orderedIds: res.entry.stopIds ?? [],
      stopsById: new Map(stops.map((s) => [s.id, s])),
      shortName: matchedRoute?.shortName,
      type: matchedRoute?.type,
    };
    routeStopsCache.set(routeId, info);
    return info;
  } catch {
    routeStopsCache.set(routeId, null);
    return null;
  }
}

// Rail (tram/light rail, subway, commuter rail) cruises much faster than a
// bus once it's out of a station — Link's 1/2 Line average ~30 mph incl.
// dwell time vs. a bus's ~22 mph incl. stops. Using the bus average for
// Link legs was silently inflating every rail-inclusive itinerary's
// duration, which kept it from ever winning on "Fastest".
const RAIL_ROUTE_TYPES = new Set([0, 1, 2]);
const RAIL_SPEED_MPS = 14; // ~31 mph avg incl. dwell

function speedForRouteType(type: number | undefined): number {
  return type !== undefined && RAIL_ROUTE_TYPES.has(type) ? RAIL_SPEED_MPS : BUS_SPEED_MPS;
}

async function findArrivalForRoute(
  stopId: string,
  routeId: string,
): Promise<OBAArrivalDeparture | null> {
  try {
    const res = await getArrivals(stopId, { minutesBefore: 1, minutesAfter: 60 });
    return (
      res.entry.arrivalsAndDepartures.find((a) => a.routeId === routeId) ?? null
    );
  } catch {
    return null;
  }
}

function arrivalBoardTime(arr: OBAArrivalDeparture): number {
  return arr.predictedDepartureTime > 0
    ? arr.predictedDepartureTime
    : arr.scheduledDepartureTime;
}

function shortNameFromRouteId(routeId: string, info?: RouteInfo | null): string {
  if (info?.shortName) return info.shortName;
  const parts = routeId.split("_");
  return parts[parts.length - 1] ?? routeId;
}

function sortByDistance(stops: OBAStop[], point: LatLng): OBAStop[] {
  return [...stops].sort(
    (a, b) =>
      haversine(point, { latitude: a.lat, longitude: a.lon }) -
      haversine(point, { latitude: b.lat, longitude: b.lon }),
  );
}

function uniqueRouteIds(stops: OBAStop[]): string[] {
  const set = new Set<string>();
  for (const s of stops) for (const r of s.routeIds ?? []) set.add(r);
  return [...set];
}

function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

function byId(stops: OBAStop[]): Map<string, OBAStop> {
  return new Map(stops.map((s) => [s.id, s]));
}

// Finds whichever stop on `route` is physically nearest `point`, searching
// the route's OWN full stop list rather than requiring the stop to be in
// the small "closest N stops overall" pool. That pool is built from the
// nearest stops of ANY kind, so in a stop-dense area (a campus, downtown) a
// rail station 900m away can easily be crowded out by dozens of closer bus
// stops and never appear in it — which used to make it impossible for a
// route like Link light rail to ever be selected as the boarding/alighting
// leg, even when it was clearly the best option and well within a
// reasonable walk. Capped at DEST_WALK_MAX_M so we don't suggest a 5-mile
// walk to a station; downstream leg-building applies its own (looser or
// stricter) checks on top of this.
function closestStopOnRoute(point: LatLng, route: RouteInfo): OBAStop | null {
  let best: OBAStop | null = null;
  let bestDist = Infinity;
  for (const stop of route.stopsById.values()) {
    const d = haversine(point, { latitude: stop.lat, longitude: stop.lon });
    if (d < bestDist) {
      bestDist = d;
      best = stop;
    }
  }
  if (!best || bestDist > DEST_WALK_MAX_M) return null;
  return best;
}

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/** Expands search radius progressively until stops are found (or we give up). */
async function progressiveStopSearch(location: LatLng): Promise<OBAStop[] | null> {
  for (const radius of SEARCH_RADII) {
    const res = await safeCall(() =>
      getNearbyStops(location, { radius, maxCount: 25 }),
    );
    if (res && res.list.length > 0) return res.list;
  }
  return null;
}

import type { LiquidityRadar, LiquidityVenueBook } from "./liquidity-radar";
import type { OrderBookLevel, QuoteAsset } from "./types";

export type LiquidityTopologyPolicy =
  | "route-normal"
  | "prefer-central-venues"
  | "avoid-fragmented-route"
  | "insufficient-data";

export type LiquidityTopologyVenue = {
  exchangeId: string;
  quoteAsset: QuoteAsset;
  midPrice: number;
  totalDepthBtc: number;
  spreadBps: number;
  centralityScore: number;
  averageDistanceBps: number;
  topologyRisk: "central" | "watch" | "outlier";
};

export type LiquidityTopologyLink = {
  fromExchange: string;
  toExchange: string;
  quoteAsset: QuoteAsset;
  bidDistanceBps: number;
  askDistanceBps: number;
  wassersteinBps: number;
  sharedDepthBtc: number;
  routingPenaltyBps: number;
};

export type LiquidityTopologyMap = {
  generatedAt: number;
  venues: LiquidityTopologyVenue[];
  links: LiquidityTopologyLink[];
  outliers: LiquidityTopologyVenue[];
  summary: {
    policy: LiquidityTopologyPolicy;
    venueCount: number;
    linkCount: number;
    centralVenue?: string;
    fragmentationScore: number;
    medianDistanceBps: number;
    maxDistanceBps: number;
    topologyHaircutBps: number;
  };
  reasons: string[];
  equation: string;
  sources: string[];
};

type DepthPoint = {
  distanceBps: number;
  cumulativeBtc: number;
};

type VenueProfile = {
  book: LiquidityVenueBook;
  midPrice: number;
  bidProfile: DepthPoint[];
  askProfile: DepthPoint[];
};

export function buildLiquidityTopologyMap(input: {
  radar?: LiquidityRadar;
  quoteAsset?: QuoteAsset;
  generatedAt?: number;
}): LiquidityTopologyMap {
  const books = (input.radar?.books ?? []).filter((book) => (input.quoteAsset ? book.quoteAsset === input.quoteAsset : true));
  const lane = chooseLane(books, input.quoteAsset);
  const laneBooks = books.filter((book) => book.quoteAsset === lane);
  if (laneBooks.length < 2) {
    return {
      generatedAt: input.generatedAt ?? Date.now(),
      venues: [],
      links: [],
      outliers: [],
      summary: {
        policy: "insufficient-data",
        venueCount: laneBooks.length,
        linkCount: 0,
        fragmentationScore: 0,
        medianDistanceBps: 0,
        maxDistanceBps: 0,
        topologyHaircutBps: 0,
      },
      reasons: ["Need at least two books in the same quote lane to compare liquidity topology."],
      equation,
      sources: input.radar?.sources ?? [],
    };
  }

  const profiles = laneBooks.map(buildProfile);
  const links = buildLinks(profiles);
  const venues = buildVenues(profiles, links);
  const distances = links.map((link) => link.wassersteinBps).sort((a, b) => a - b);
  const medianDistanceBps = median(distances);
  const maxDistanceBps = Math.max(0, ...distances);
  const centralVenue = [...venues].sort((a, b) => b.centralityScore - a.centralityScore)[0];
  const outliers = venues.filter((venue) => venue.topologyRisk === "outlier");
  const fragmentationScore = clampScore(medianDistanceBps * 2.2 + maxDistanceBps * 0.75 + outliers.length * 18);
  const topologyHaircutBps = round(Math.max(0, medianDistanceBps * 0.18 + outliers.length * 2.5), 2);
  const policy =
    outliers.length > 0 || fragmentationScore >= 65
      ? "avoid-fragmented-route"
      : fragmentationScore >= 35
        ? "prefer-central-venues"
        : "route-normal";

  return {
    generatedAt: input.generatedAt ?? Date.now(),
    venues,
    links: links.sort((a, b) => a.wassersteinBps - b.wassersteinBps),
    outliers,
    summary: {
      policy,
      venueCount: venues.length,
      linkCount: links.length,
      centralVenue: centralVenue?.exchangeId,
      fragmentationScore,
      medianDistanceBps: round(medianDistanceBps, 2),
      maxDistanceBps: round(maxDistanceBps, 2),
      topologyHaircutBps,
    },
    reasons: buildReasons(policy, centralVenue, outliers, fragmentationScore),
    equation,
    sources: input.radar?.sources ?? [],
  };
}

const equation =
  "W1(book_i, book_j) = integral |CDF_depth_i(d) - CDF_depth_j(d)| dd across bid/ask distance-from-mid buckets; topology_haircut_bps rises with median W1, max W1, and outlier count.";

function chooseLane(books: LiquidityVenueBook[], requested?: QuoteAsset): QuoteAsset {
  if (requested) return requested;
  const usd = books.filter((book) => book.quoteAsset === "USD").length;
  const usdt = books.filter((book) => book.quoteAsset === "USDT").length;
  return usd >= usdt ? "USD" : "USDT";
}

function buildProfile(book: LiquidityVenueBook): VenueProfile {
  const midPrice = midpoint(book);
  return {
    book,
    midPrice,
    bidProfile: sideProfile(book.bids, midPrice, "bid"),
    askProfile: sideProfile(book.asks, midPrice, "ask"),
  };
}

function sideProfile(levels: OrderBookLevel[], midPrice: number, side: "bid" | "ask"): DepthPoint[] {
  let cumulativeBtc = 0;
  return levels
    .slice(0, 12)
    .map((level) => {
      cumulativeBtc += level.size;
      const distanceBps =
        midPrice > 0
          ? side === "bid"
            ? ((midPrice - level.price) / midPrice) * 10_000
            : ((level.price - midPrice) / midPrice) * 10_000
          : 0;
      return {
        distanceBps: Math.max(0, distanceBps),
        cumulativeBtc,
      };
    })
    .sort((a, b) => a.distanceBps - b.distanceBps);
}

function buildLinks(profiles: VenueProfile[]): LiquidityTopologyLink[] {
  const links: LiquidityTopologyLink[] = [];
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const first = profiles[i];
      const second = profiles[j];
      if (!first || !second) continue;
      const bidDistanceBps = wassersteinDistance(first.bidProfile, second.bidProfile);
      const askDistanceBps = wassersteinDistance(first.askProfile, second.askProfile);
      const wassersteinBps = (bidDistanceBps + askDistanceBps) / 2;
      const sharedDepthBtc = Math.min(
        first.book.bidDepthBtc + first.book.askDepthBtc,
        second.book.bidDepthBtc + second.book.askDepthBtc,
      );
      links.push({
        fromExchange: first.book.exchangeId,
        toExchange: second.book.exchangeId,
        quoteAsset: first.book.quoteAsset,
        bidDistanceBps: round(bidDistanceBps, 2),
        askDistanceBps: round(askDistanceBps, 2),
        wassersteinBps: round(wassersteinBps, 2),
        sharedDepthBtc: round(sharedDepthBtc, 6),
        routingPenaltyBps: round(wassersteinBps * 0.12 + Math.max(0, 1 / Math.max(sharedDepthBtc, 0.01)), 2),
      });
    }
  }
  return links;
}

function wassersteinDistance(first: DepthPoint[], second: DepthPoint[]): number {
  const totalFirst = first[first.length - 1]?.cumulativeBtc ?? 0;
  const totalSecond = second[second.length - 1]?.cumulativeBtc ?? 0;
  if (totalFirst <= 0 || totalSecond <= 0) return 0;
  const buckets = uniqueNumbers([0, ...first.map((point) => point.distanceBps), ...second.map((point) => point.distanceBps)])
    .sort((a, b) => a - b);
  let area = 0;
  for (let index = 1; index < buckets.length; index += 1) {
    const left = buckets[index - 1] ?? 0;
    const right = buckets[index] ?? left;
    const midpointBps = (left + right) / 2;
    const cdfFirst = cumulativeAt(first, midpointBps) / totalFirst;
    const cdfSecond = cumulativeAt(second, midpointBps) / totalSecond;
    area += Math.abs(cdfFirst - cdfSecond) * (right - left);
  }
  return area;
}

function cumulativeAt(points: DepthPoint[], distanceBps: number): number {
  let cumulative = 0;
  for (const point of points) {
    if (point.distanceBps <= distanceBps + 1e-9) cumulative = point.cumulativeBtc;
    else break;
  }
  return cumulative;
}

function buildVenues(profiles: VenueProfile[], links: LiquidityTopologyLink[]): LiquidityTopologyVenue[] {
  const raw = profiles.map((profile) => {
    const distances = links
      .filter((link) => link.fromExchange === profile.book.exchangeId || link.toExchange === profile.book.exchangeId)
      .map((link) => link.wassersteinBps);
    const averageDistanceBps = mean(distances);
    const centralityScore = clampScore(100 - averageDistanceBps * 2.6 - profile.book.spreadBps * 0.9);
    const topologyRisk = averageDistanceBps >= 24 ? "outlier" : averageDistanceBps >= 12 ? "watch" : "central";
    return {
      exchangeId: profile.book.exchangeId,
      quoteAsset: profile.book.quoteAsset,
      midPrice: round(profile.midPrice, 2),
      totalDepthBtc: round(profile.book.bidDepthBtc + profile.book.askDepthBtc, 6),
      spreadBps: round(profile.book.spreadBps, 2),
      centralityScore,
      averageDistanceBps: round(averageDistanceBps, 2),
      topologyRisk,
    } satisfies LiquidityTopologyVenue;
  });
  const bestScore = Math.max(0, ...raw.map((venue) => venue.centralityScore));
  return raw
    .map((venue) => ({
      ...venue,
      topologyRisk: venue.topologyRisk === "central" && venue.centralityScore < bestScore - 20 ? "watch" : venue.topologyRisk,
    }))
    .sort((a, b) => b.centralityScore - a.centralityScore || a.exchangeId.localeCompare(b.exchangeId));
}

function buildReasons(
  policy: LiquidityTopologyPolicy,
  centralVenue: LiquidityTopologyVenue | undefined,
  outliers: LiquidityTopologyVenue[],
  fragmentationScore: number,
): string[] {
  if (policy === "route-normal") {
    return [`${centralVenue?.exchangeId ?? "Central venue"} sits near the order-book shape cluster; topology risk is low.`];
  }
  if (policy === "prefer-central-venues") {
    return [`Liquidity topology is moderately fragmented (${fragmentationScore}/100); prefer central venues before routing size.`];
  }
  if (policy === "avoid-fragmented-route") {
    return [
      `Order-book shape is fragmented (${fragmentationScore}/100); avoid routes touching ${outliers.map((venue) => venue.exchangeId).join(", ") || "outlier venues"}.`,
    ];
  }
  return ["Need at least two books in the same quote lane to compare liquidity topology."];
}

function midpoint(book: LiquidityVenueBook): number {
  return book.topBid > 0 && book.topAsk > 0 ? (book.topBid + book.topAsk) / 2 : book.bids[0]?.price ?? book.asks[0]?.price ?? 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2
    : values[middle] ?? 0;
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter(Number.isFinite))];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

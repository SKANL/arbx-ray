import type { QuoteAsset } from "./types";

export type LeadLagVenueId = "coinbase" | "kraken" | "bitstamp" | "gemini" | "bitfinex" | "binance";
export type LeadLagSide = "buy" | "sell";

export type LeadLagTrade = {
  venue: LeadLagVenueId;
  symbol: string;
  quoteAsset: QuoteAsset;
  tradeId: string;
  price: number;
  sizeBtc: number;
  notionalUsd: number;
  timestamp: number;
  receivedAt: number;
  side: LeadLagSide;
};

export type LeadLagBucket = {
  startedAt: number;
  close: number;
  returnBps: number;
  signedFlowBtc: number;
  tradeCount: number;
};

export type LeadLagVenueSignal = {
  venue: LeadLagVenueId;
  label: string;
  tradeCount: number;
  bucketCount: number;
  latestReturnBps: number;
  cumulativeReturnBps: number;
  signedFlowBtc: number;
  flowImbalance: number;
  volatilityBps: number;
  freshnessMs: number;
  leadershipScore: number;
  followerScore: number;
  state: "leader" | "follower" | "neutral" | "stale";
  explanation: string;
};

export type LeadLagPair = {
  leader: LeadLagVenueId;
  follower: LeadLagVenueId;
  lagBuckets: number;
  correlation: number;
  confidence: number;
  samples: number;
};

export type LeadLagOracle = {
  generatedAt: number;
  bucketMs: number;
  venues: LeadLagVenueSignal[];
  pairs: LeadLagPair[];
  summary: {
    venueCount: number;
    leaderVenue?: LeadLagVenueId;
    followerVenue?: LeadLagVenueId;
    leaderScore: number;
    predictedDriftBps: number;
    consensusDriftBps: number;
    divergenceBps: number;
    executionHaircutBps: number;
    policy: "follow-leader" | "cap-size" | "wait" | "halt";
    confidence: "high" | "medium" | "low";
  };
  equation: string;
  sources: string[];
  errors: string[];
};

type BucketSeries = {
  venue: LeadLagVenueId;
  buckets: LeadLagBucket[];
  tradeCount: number;
  signedFlowBtc: number;
  totalVolumeBtc: number;
  firstPrice: number;
  lastPrice: number;
  lastTimestamp: number;
};

export function parseCoinbaseLeadLagTrades(payload: unknown, receivedAt = Date.now()): LeadLagTrade[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((row): LeadLagTrade | undefined => {
      if (!isRecord(row)) return undefined;
      const price = numberValue(row.price);
      const sizeBtc = numberValue(row.size);
      const timestamp = typeof row.time === "string" ? Date.parse(row.time) : Number.NaN;
      const makerSide = row.side === "buy" || row.side === "sell" ? row.side : undefined;
      if (!makerSide || !isFinitePositive(price) || !isFinitePositive(sizeBtc) || !Number.isFinite(timestamp)) return undefined;
      const side = oppositeSide(makerSide);
      return trade("coinbase", "BTC-USD", "USD", row.trade_id, price, sizeBtc, timestamp, receivedAt, side);
    })
    .filter((item): item is LeadLagTrade => Boolean(item));
}

export function parseKrakenLeadLagTrades(payload: unknown, receivedAt = Date.now()): LeadLagTrade[] {
  if (!isRecord(payload) || !isRecord(payload.result)) return [];
  const rows = Object.entries(payload.result)
    .filter(([key, value]) => key !== "last" && Array.isArray(value))
    .flatMap(([, value]) => value as unknown[]);
  return rows
    .map((row): LeadLagTrade | undefined => {
      if (!Array.isArray(row)) return undefined;
      const price = numberValue(row[0]);
      const sizeBtc = numberValue(row[1]);
      const timestamp = numberValue(row[2]) * 1_000;
      const side = row[3] === "b" ? "buy" : row[3] === "s" ? "sell" : undefined;
      if (!side || !isFinitePositive(price) || !isFinitePositive(sizeBtc) || !Number.isFinite(timestamp)) return undefined;
      return trade("kraken", "BTC/USD", "USD", row[6], price, sizeBtc, timestamp, receivedAt, side);
    })
    .filter((item): item is LeadLagTrade => Boolean(item));
}

export function parseBitstampLeadLagTrades(payload: unknown, receivedAt = Date.now()): LeadLagTrade[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((row): LeadLagTrade | undefined => {
      if (!isRecord(row)) return undefined;
      const price = numberValue(row.price);
      const sizeBtc = numberValue(row.amount);
      const timestamp = numberValue(row.date) * 1_000;
      const side = String(row.type) === "0" ? "buy" : String(row.type) === "1" ? "sell" : undefined;
      if (!side || !isFinitePositive(price) || !isFinitePositive(sizeBtc) || !Number.isFinite(timestamp)) return undefined;
      return trade("bitstamp", "btcusd", "USD", row.tid, price, sizeBtc, timestamp, receivedAt, side);
    })
    .filter((item): item is LeadLagTrade => Boolean(item));
}

export function parseGeminiLeadLagTrades(payload: unknown, receivedAt = Date.now()): LeadLagTrade[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((row): LeadLagTrade | undefined => {
      if (!isRecord(row)) return undefined;
      const price = numberValue(row.price);
      const sizeBtc = numberValue(row.amount);
      const timestamp = numberValue(row.timestampms);
      const side = row.type === "buy" || row.type === "sell" ? row.type : undefined;
      if (!side || !isFinitePositive(price) || !isFinitePositive(sizeBtc) || !Number.isFinite(timestamp)) return undefined;
      return trade("gemini", "btcusd", "USD", row.tid, price, sizeBtc, timestamp, receivedAt, side);
    })
    .filter((item): item is LeadLagTrade => Boolean(item));
}

export function parseBitfinexLeadLagTrades(payload: unknown, receivedAt = Date.now()): LeadLagTrade[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((row): LeadLagTrade | undefined => {
      if (!Array.isArray(row)) return undefined;
      const timestamp = numberValue(row[1]);
      const amount = numberValue(row[2]);
      const price = numberValue(row[3]);
      const sizeBtc = Math.abs(amount);
      const side = amount >= 0 ? "buy" : "sell";
      if (!isFinitePositive(price) || !isFinitePositive(sizeBtc) || !Number.isFinite(timestamp)) return undefined;
      return trade("bitfinex", "tBTCUSD", "USD", row[0], price, sizeBtc, timestamp, receivedAt, side);
    })
    .filter((item): item is LeadLagTrade => Boolean(item));
}

export function parseBinanceLeadLagTrades(payload: unknown, receivedAt = Date.now()): LeadLagTrade[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((row): LeadLagTrade | undefined => {
      if (!isRecord(row)) return undefined;
      const price = numberValue(row.p);
      const sizeBtc = numberValue(row.q);
      const timestamp = numberValue(row.T);
      const side = row.m === true ? "sell" : "buy";
      if (!isFinitePositive(price) || !isFinitePositive(sizeBtc) || !Number.isFinite(timestamp)) return undefined;
      return trade("binance", "BTCUSDT", "USDT", row.a, price, sizeBtc, timestamp, receivedAt, side);
    })
    .filter((item): item is LeadLagTrade => Boolean(item));
}

export function buildLeadLagOracle(input: {
  tradesByVenue: Partial<Record<LeadLagVenueId, LeadLagTrade[]>>;
  observedAt?: number;
  bucketMs?: number;
  sources?: string[];
  errors?: string[];
}): LeadLagOracle {
  const generatedAt = input.observedAt ?? Date.now();
  const bucketMs = input.bucketMs ?? 10_000;
  const series = (Object.entries(input.tradesByVenue) as Array<[LeadLagVenueId, LeadLagTrade[] | undefined]>)
    .map(([venue, trades]) => buildBucketSeries(venue, trades ?? [], bucketMs))
    .filter((item): item is BucketSeries => Boolean(item));
  const pairs = rankLeadLagPairs(series, bucketMs);
  const venueScores = scoreVenues(series, pairs, generatedAt);
  const bestPair = pairs[0];
  const consensusDriftBps = venueScores.length
    ? round(venueScores.reduce((sum, venue) => sum + venue.latestReturnBps, 0) / venueScores.length, 2)
    : 0;
  const predictedDriftBps = bestPair
    ? round((series.find((item) => item.venue === bestPair.leader)?.buckets.at(-1)?.returnBps ?? 0) * Math.max(0.25, bestPair.confidence), 2)
    : 0;
  const divergenceBps = bestPair
    ? round(Math.abs((series.find((item) => item.venue === bestPair.leader)?.buckets.at(-1)?.returnBps ?? 0) - (series.find((item) => item.venue === bestPair.follower)?.buckets.at(-1)?.returnBps ?? 0)), 2)
    : 0;
  const leaderScore = venueScores[0]?.leadershipScore ?? 0;
  const executionHaircutBps = round(Math.max(0, divergenceBps * 0.45 + Math.max(0, 70 - leaderScore) * 0.08), 2);
  const confidence = leaderScore >= 72 && (bestPair?.samples ?? 0) >= 5 ? "high" : leaderScore >= 48 ? "medium" : "low";
  const policy =
    series.length < 2 || !bestPair
      ? "wait"
      : executionHaircutBps >= 18 || venueScores.some((venue) => venue.freshnessMs > 180_000)
        ? "halt"
        : leaderScore >= 62 && confidence !== "low"
          ? "follow-leader"
          : "cap-size";

  return {
    generatedAt,
    bucketMs,
    venues: venueScores,
    pairs,
    summary: {
      venueCount: venueScores.length,
      leaderVenue: bestPair?.leader,
      followerVenue: bestPair?.follower,
      leaderScore: round(leaderScore, 2),
      predictedDriftBps,
      consensusDriftBps,
      divergenceBps,
      executionHaircutBps,
      policy,
      confidence,
    },
    equation:
      "leader_score = max_lagged_corr(venue_t, other_t+lag) * sample_confidence * freshness; predicted_drift = latest_leader_return_bps * pair_confidence; haircut = divergence_bps*0.45 + weak_leader_penalty",
    sources: uniqueStrings(input.sources ?? []),
    errors: input.errors ?? [],
  };
}

function buildBucketSeries(venue: LeadLagVenueId, trades: LeadLagTrade[], bucketMs: number): BucketSeries | undefined {
  const valid = trades
    .filter((item) => item.venue === venue && isFinitePositive(item.price) && isFinitePositive(item.sizeBtc))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (valid.length < 3) return undefined;
  const buckets = new Map<number, { first: number; close: number; signedFlowBtc: number; tradeCount: number }>();
  for (const item of valid) {
    const startedAt = Math.floor(item.timestamp / bucketMs) * bucketMs;
    const existing = buckets.get(startedAt);
    const signed = item.side === "buy" ? item.sizeBtc : -item.sizeBtc;
    if (!existing) buckets.set(startedAt, { first: item.price, close: item.price, signedFlowBtc: signed, tradeCount: 1 });
    else {
      existing.close = item.price;
      existing.signedFlowBtc += signed;
      existing.tradeCount += 1;
    }
  }
  const sorted = [...buckets.entries()].sort(([a], [b]) => a - b);
  if (sorted.length < 3) return undefined;
  let previousClose = sorted[0][1].first;
  const output = sorted.map(([startedAt, bucket]) => {
    const returnBps = previousClose > 0 ? ((bucket.close - previousClose) / previousClose) * 10_000 : 0;
    previousClose = bucket.close;
    return { startedAt, close: bucket.close, returnBps, signedFlowBtc: bucket.signedFlowBtc, tradeCount: bucket.tradeCount };
  });
  const totalVolumeBtc = valid.reduce((sum, item) => sum + item.sizeBtc, 0);
  const signedFlowBtc = valid.reduce((sum, item) => sum + (item.side === "buy" ? item.sizeBtc : -item.sizeBtc), 0);
  return {
    venue,
    buckets: output,
    tradeCount: valid.length,
    signedFlowBtc,
    totalVolumeBtc,
    firstPrice: valid[0].price,
    lastPrice: valid[valid.length - 1].price,
    lastTimestamp: valid[valid.length - 1].timestamp,
  };
}

function rankLeadLagPairs(series: BucketSeries[], bucketMs: number): LeadLagPair[] {
  const pairs: LeadLagPair[] = [];
  for (const leader of series) {
    for (const follower of series) {
      if (leader.venue === follower.venue) continue;
      for (const lagBuckets of [1, 2, 3]) {
        const aligned = alignReturns(leader.buckets, follower.buckets, lagBuckets, bucketMs);
        if (aligned.left.length < 3) continue;
        const corr = correlation(aligned.left, aligned.right);
        if (corr <= 0) continue;
        const confidence = clamp((corr + Math.min(1, aligned.left.length / 8)) / 2, 0, 1);
        pairs.push({
          leader: leader.venue,
          follower: follower.venue,
          lagBuckets,
          correlation: round(corr, 4),
          confidence: round(confidence, 4),
          samples: aligned.left.length,
        });
      }
    }
  }
  return pairs.sort((a, b) => b.correlation * b.confidence - a.correlation * a.confidence);
}

function scoreVenues(series: BucketSeries[], pairs: LeadLagPair[], generatedAt: number): LeadLagVenueSignal[] {
  return series
    .map((item): LeadLagVenueSignal => {
      const leading = pairs.filter((pair) => pair.leader === item.venue);
      const following = pairs.filter((pair) => pair.follower === item.venue);
      const freshnessMs = Math.max(0, generatedAt - item.lastTimestamp);
      const freshnessMultiplier = freshnessMs > 180_000 ? 0.35 : freshnessMs > 90_000 ? 0.7 : 1;
      const leadershipScore = clamp(Math.max(0, ...leading.map((pair) => pair.correlation * pair.confidence * 100)) * freshnessMultiplier, 0, 100);
      const followerScore = clamp(Math.max(0, ...following.map((pair) => pair.correlation * pair.confidence * 100)) * freshnessMultiplier, 0, 100);
      const returns = item.buckets.map((bucket) => bucket.returnBps);
      const latestReturnBps = item.buckets.at(-1)?.returnBps ?? 0;
      const cumulativeReturnBps = item.firstPrice > 0 ? ((item.lastPrice - item.firstPrice) / item.firstPrice) * 10_000 : 0;
      const flowImbalance = item.totalVolumeBtc > 0 ? item.signedFlowBtc / item.totalVolumeBtc : 0;
      const state =
        freshnessMs > 180_000
          ? "stale"
          : leadershipScore >= followerScore + 10 && leadershipScore >= 35
            ? "leader"
            : followerScore >= leadershipScore + 10 && followerScore >= 35
              ? "follower"
              : "neutral";
      return {
        venue: item.venue,
        label: venueLabel(item.venue),
        tradeCount: item.tradeCount,
        bucketCount: item.buckets.length,
        latestReturnBps: round(latestReturnBps, 2),
        cumulativeReturnBps: round(cumulativeReturnBps, 2),
        signedFlowBtc: round(item.signedFlowBtc, 6),
        flowImbalance: round(flowImbalance, 4),
        volatilityBps: round(standardDeviation(returns), 2),
        freshnessMs,
        leadershipScore: round(leadershipScore, 2),
        followerScore: round(followerScore, 2),
        state,
        explanation: `${item.buckets.length} buckets, latest ${round(latestReturnBps, 2)} bps, flow ${round(flowImbalance * 100, 1)}%`,
      };
    })
    .sort((a, b) => b.leadershipScore - a.leadershipScore || b.tradeCount - a.tradeCount);
}

function alignReturns(left: LeadLagBucket[], right: LeadLagBucket[], lagBuckets: number, bucketMs: number): { left: number[]; right: number[] } {
  const rightByTime = new Map(right.map((bucket) => [bucket.startedAt, bucket.returnBps]));
  const alignedLeft: number[] = [];
  const alignedRight: number[] = [];
  for (const bucket of left) {
    const rightReturn = rightByTime.get(bucket.startedAt + lagBuckets * bucketMs);
    if (rightReturn === undefined) continue;
    alignedLeft.push(bucket.returnBps);
    alignedRight.push(rightReturn);
  }
  return { left: alignedLeft, right: alignedRight };
}

function trade(
  venue: LeadLagVenueId,
  symbol: string,
  quoteAsset: QuoteAsset,
  id: unknown,
  price: number,
  sizeBtc: number,
  timestamp: number,
  receivedAt: number,
  side: LeadLagSide,
): LeadLagTrade {
  return {
    venue,
    symbol,
    quoteAsset,
    tradeId: String(id ?? `${timestamp}-${price}-${sizeBtc}`),
    price,
    sizeBtc,
    notionalUsd: price * sizeBtc,
    timestamp,
    receivedAt,
    side,
  };
}

function correlation(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length < 2) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator > 1e-12 ? numerator / denominator : 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function oppositeSide(side: LeadLagSide): LeadLagSide {
  return side === "buy" ? "sell" : "buy";
}

function venueLabel(venue: LeadLagVenueId): string {
  const labels: Record<LeadLagVenueId, string> = {
    coinbase: "Coinbase",
    kraken: "Kraken",
    bitstamp: "Bitstamp",
    gemini: "Gemini",
    bitfinex: "Bitfinex",
    binance: "Binance",
  };
  return labels[venue];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

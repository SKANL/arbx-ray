import type { QuoteAsset } from "./types";

export type VenueTicker = {
  exchangeId: string;
  exchangeName: string;
  quoteAsset: QuoteAsset;
  lastUsd: number;
  volumeUsd: number;
  spreadPercent: number;
  costToMoveUpUsd: number;
  costToMoveDownUsd: number;
  trustScore: "green" | "yellow" | "red" | "unknown";
  isStale: boolean;
  isAnomaly: boolean;
  lastFetchAt: string;
  qualityScore: number;
};

export type VenueRoute = {
  quoteAsset: QuoteAsset;
  buyExchange: string;
  sellExchange: string;
  buyPriceUsd: number;
  sellPriceUsd: number;
  grossSpreadBps: number;
  combinedQuality: number;
  volumeFloorUsd: number;
  routeScore: number;
};

export type VenueIntelligence = {
  generatedAt: number;
  tickers: VenueTicker[];
  routes: VenueRoute[];
  summary: {
    venuesTracked: number;
    medianSpreadPercent: number;
    totalVolumeUsd: number;
    bestRouteScore: number;
    staleCount: number;
    anomalyCount: number;
  };
  sources: string[];
  errors: string[];
};

const trackedVenueIds: Record<string, string> = {
  binance: "binance",
  kraken: "kraken",
  coinbase_exchange: "coinbase",
  gemini: "gemini",
  bitfinex: "bitfinex",
  bitstamp: "bitstamp",
  gate: "gate",
  gate_io: "gate",
  okx: "okx",
  bybit_spot: "bybit",
  bybit: "bybit",
};

export function buildVenueIntelligence(input: {
  coinGeckoTickers: unknown;
  errors?: string[];
}): VenueIntelligence {
  const tickers = parseCoinGeckoVenueTickers(input.coinGeckoTickers);
  const routes = buildVenueRoutes(tickers);
  const spreads = tickers.map((ticker) => ticker.spreadPercent).sort((a, b) => a - b);
  return {
    generatedAt: Date.now(),
    tickers,
    routes,
    summary: {
      venuesTracked: tickers.length,
      medianSpreadPercent: median(spreads),
      totalVolumeUsd: tickers.reduce((sum, ticker) => sum + ticker.volumeUsd, 0),
      bestRouteScore: routes[0]?.routeScore ?? 0,
      staleCount: tickers.filter((ticker) => ticker.isStale).length,
      anomalyCount: tickers.filter((ticker) => ticker.isAnomaly).length,
    },
    sources: ["https://api.coingecko.com/api/v3/coins/bitcoin/tickers"],
    errors: input.errors ?? [],
  };
}

export function parseCoinGeckoVenueTickers(payload: unknown): VenueTicker[] {
  if (!isRecord(payload) || !Array.isArray(payload.tickers)) return [];
  const bestByVenue = new Map<string, VenueTicker>();

  for (const rawTicker of payload.tickers) {
    if (!isRecord(rawTicker) || !isRecord(rawTicker.market)) continue;
    if (String(rawTicker.base).toUpperCase() !== "BTC") continue;

    const quoteAsset = parseQuoteAsset(rawTicker.target);
    const venueIdentifier = String(rawTicker.market.identifier ?? "");
    const exchangeId = trackedVenueIds[venueIdentifier];
    if (!quoteAsset || !exchangeId) continue;

    const convertedLast = isRecord(rawTicker.converted_last)
      ? numberValue(rawTicker.converted_last.usd)
      : numberValue(rawTicker.last);
    const convertedVolume = isRecord(rawTicker.converted_volume)
      ? numberValue(rawTicker.converted_volume.usd)
      : 0;
    if (convertedLast <= 0 || convertedVolume <= 0) continue;

    const ticker: VenueTicker = {
      exchangeId,
      exchangeName: String(rawTicker.market.name ?? exchangeId),
      quoteAsset,
      lastUsd: convertedLast,
      volumeUsd: convertedVolume,
      spreadPercent: Math.max(0, numberValue(rawTicker.bid_ask_spread_percentage)),
      costToMoveUpUsd: Math.max(0, numberValue(rawTicker.cost_to_move_up_usd)),
      costToMoveDownUsd: Math.max(0, numberValue(rawTicker.cost_to_move_down_usd)),
      trustScore: parseTrustScore(rawTicker.trust_score),
      isStale: Boolean(rawTicker.is_stale),
      isAnomaly: Boolean(rawTicker.is_anomaly),
      lastFetchAt: String(rawTicker.last_fetch_at ?? ""),
      qualityScore: 0,
    };
    ticker.qualityScore = scoreVenueTicker(ticker);

    const key = `${ticker.exchangeId}-${ticker.quoteAsset}`;
    const current = bestByVenue.get(key);
    if (!current || ticker.qualityScore > current.qualityScore) bestByVenue.set(key, ticker);
  }

  return [...bestByVenue.values()].sort((a, b) => b.qualityScore - a.qualityScore);
}

export function buildVenueRoutes(tickers: VenueTicker[]): VenueRoute[] {
  const routes: VenueRoute[] = [];
  for (const buy of tickers) {
    for (const sell of tickers) {
      if (buy.exchangeId === sell.exchangeId || buy.quoteAsset !== sell.quoteAsset) continue;
      if (sell.lastUsd <= buy.lastUsd) continue;
      const mid = (buy.lastUsd + sell.lastUsd) / 2;
      const grossSpreadBps = ((sell.lastUsd - buy.lastUsd) / mid) * 10_000;
      const combinedQuality = (buy.qualityScore + sell.qualityScore) / 2;
      const volumeFloorUsd = Math.min(buy.volumeUsd, sell.volumeUsd);
      const depthFloorUsd = Math.min(
        nonZeroOrInfinity(buy.costToMoveUpUsd),
        nonZeroOrInfinity(sell.costToMoveDownUsd),
      );
      const liquidityScore = Math.min(25, Math.log10(Math.max(1, volumeFloorUsd)) * 2.6);
      const depthScore = Number.isFinite(depthFloorUsd)
        ? Math.min(15, Math.log10(Math.max(1, depthFloorUsd)) * 1.8)
        : 0;
      routes.push({
        quoteAsset: buy.quoteAsset,
        buyExchange: buy.exchangeId,
        sellExchange: sell.exchangeId,
        buyPriceUsd: buy.lastUsd,
        sellPriceUsd: sell.lastUsd,
        grossSpreadBps,
        combinedQuality,
        volumeFloorUsd,
        routeScore: clamp(
          grossSpreadBps * 1.4 + combinedQuality * 0.55 + liquidityScore + depthScore,
          0,
          100,
        ),
      });
    }
  }
  return routes.sort((a, b) => b.routeScore - a.routeScore).slice(0, 12);
}

function scoreVenueTicker(ticker: VenueTicker): number {
  const spreadBps = ticker.spreadPercent * 100;
  const spreadScore = Math.max(0, 35 - spreadBps * 1.8);
  const volumeScore = Math.min(25, Math.log10(Math.max(1, ticker.volumeUsd)) * 2.7);
  const depthUsd = Math.min(
    nonZeroOrInfinity(ticker.costToMoveUpUsd),
    nonZeroOrInfinity(ticker.costToMoveDownUsd),
  );
  const depthScore = Number.isFinite(depthUsd) ? Math.min(20, Math.log10(Math.max(1, depthUsd)) * 2) : 0;
  const trustScore = ticker.trustScore === "green" ? 15 : ticker.trustScore === "yellow" ? 9 : 3;
  const penalty = (ticker.isStale ? 18 : 0) + (ticker.isAnomaly ? 25 : 0);
  return Math.round(clamp(spreadScore + volumeScore + depthScore + trustScore - penalty, 0, 100));
}

function parseQuoteAsset(value: unknown): QuoteAsset | undefined {
  const normalized = String(value).toUpperCase();
  if (normalized === "USD" || normalized === "USDT") return normalized;
  return undefined;
}

function parseTrustScore(value: unknown): VenueTicker["trustScore"] {
  if (value === "green" || value === "yellow" || value === "red") return value;
  return "unknown";
}

function nonZeroOrInfinity(value: number): number {
  return value > 0 ? value : Number.POSITIVE_INFINITY;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2 : values[middle] ?? 0;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

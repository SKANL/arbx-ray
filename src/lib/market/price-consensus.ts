export type ConsensusQuoteAsset = "USD" | "USDT" | "MXN";

export type ConsensusTicker = {
  venue: string;
  label: string;
  pair: string;
  quoteAsset: ConsensusQuoteAsset;
  priceUsd: number;
  rawPrice: number;
  receivedAt: number;
  source: string;
  fxRate?: number;
  exchangeTimestamp?: number;
};

export type ConsensusVenue = ConsensusTicker & {
  premiumUsd: number;
  premiumBps: number;
  robustZScore: number;
  ageMs: number;
  state: "normal" | "watch" | "outlier" | "stale";
};

export type PriceConsensusOracle = {
  generatedAt: number;
  consensusPriceUsd: number;
  medianAbsoluteDeviationUsd: number;
  venues: ConsensusVenue[];
  summary: {
    venueCount: number;
    normalCount: number;
    outlierCount: number;
    staleCount: number;
    maxPremiumBps: number;
    confidence: "high" | "medium" | "low";
  };
  explanation: string;
  sources: string[];
  errors: string[];
};

export function parseCoinbaseTicker(payload: unknown, receivedAt = Date.now()): ConsensusTicker | undefined {
  if (!isRecord(payload)) return undefined;
  const price = numberValue(payload.price);
  if (!isFinitePositive(price)) return undefined;
  return {
    venue: "coinbase",
    label: "Coinbase",
    pair: "BTC-USD",
    quoteAsset: "USD",
    priceUsd: price,
    rawPrice: price,
    receivedAt,
    source: "https://api.exchange.coinbase.com/products/BTC-USD/ticker",
    exchangeTimestamp: typeof payload.time === "string" ? Date.parse(payload.time) : undefined,
  };
}

export function parseBinanceTicker(payload: unknown, receivedAt = Date.now()): ConsensusTicker | undefined {
  if (!isRecord(payload)) return undefined;
  const price = numberValue(payload.price);
  if (!isFinitePositive(price)) return undefined;
  return {
    venue: "binance",
    label: "Binance",
    pair: "BTCUSDT",
    quoteAsset: "USDT",
    priceUsd: price,
    rawPrice: price,
    receivedAt,
    source: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
  };
}

export function parseKrakenTicker(payload: unknown, receivedAt = Date.now()): ConsensusTicker | undefined {
  if (!isRecord(payload) || !isRecord(payload.result)) return undefined;
  const ticker = Object.values(payload.result).find(isRecord);
  if (!ticker || !Array.isArray(ticker.c)) return undefined;
  const price = numberValue(ticker.c[0]);
  if (!isFinitePositive(price)) return undefined;
  return {
    venue: "kraken",
    label: "Kraken",
    pair: "XBTUSD",
    quoteAsset: "USD",
    priceUsd: price,
    rawPrice: price,
    receivedAt,
    source: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
  };
}

export function parseBitstampTicker(payload: unknown, receivedAt = Date.now()): ConsensusTicker | undefined {
  if (!isRecord(payload)) return undefined;
  const price = numberValue(payload.last);
  if (!isFinitePositive(price)) return undefined;
  return {
    venue: "bitstamp",
    label: "Bitstamp",
    pair: "btcusd",
    quoteAsset: "USD",
    priceUsd: price,
    rawPrice: price,
    receivedAt,
    source: "https://www.bitstamp.net/api/v2/ticker/btcusd/",
    exchangeTimestamp: numberValue(payload.timestamp) * 1_000 || undefined,
  };
}

export function parseBitsoTicker(payload: unknown, usdMxnRate: number, receivedAt = Date.now()): ConsensusTicker | undefined {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.payload)) return undefined;
  const rawPrice = numberValue(payload.payload.last);
  if (!isFinitePositive(rawPrice) || !isFinitePositive(usdMxnRate)) return undefined;
  return {
    venue: "bitso",
    label: "Bitso",
    pair: String(payload.payload.book ?? "btc_mxn"),
    quoteAsset: "MXN",
    priceUsd: rawPrice / usdMxnRate,
    rawPrice,
    fxRate: usdMxnRate,
    receivedAt,
    source: "https://api.bitso.com/v3/ticker/?book=btc_mxn",
    exchangeTimestamp: typeof payload.payload.created_at === "string" ? Date.parse(payload.payload.created_at) : undefined,
  };
}

export function buildPriceConsensusOracle(input: {
  tickers: Array<ConsensusTicker | undefined>;
  generatedAt?: number;
  staleMs?: number;
  errors?: string[];
}): PriceConsensusOracle {
  const generatedAt = input.generatedAt ?? Date.now();
  const staleMs = input.staleMs ?? 30_000;
  const tickers = input.tickers
    .filter((ticker): ticker is ConsensusTicker => Boolean(ticker))
    .filter((ticker) => isFinitePositive(ticker.priceUsd));
  const prices = tickers.map((ticker) => ticker.priceUsd).sort((a, b) => a - b);
  const consensusPriceUsd = median(prices);
  const deviations = prices.map((price) => Math.abs(price - consensusPriceUsd)).sort((a, b) => a - b);
  const medianAbsoluteDeviationUsd = median(deviations);
  const robustScale = Math.max(1, medianAbsoluteDeviationUsd * 1.4826);
  const venues = tickers
    .map((ticker): ConsensusVenue => {
      const premiumUsd = ticker.priceUsd - consensusPriceUsd;
      const premiumBps = consensusPriceUsd > 0 ? (premiumUsd / consensusPriceUsd) * 10_000 : 0;
      const robustZScore = premiumUsd / robustScale;
      const ageMs = Math.max(0, generatedAt - (ticker.exchangeTimestamp ?? ticker.receivedAt));
      const state = ageMs > staleMs
        ? "stale"
        : Math.abs(robustZScore) >= 6 || Math.abs(premiumBps) >= 120
          ? "outlier"
          : Math.abs(robustZScore) >= 3 || Math.abs(premiumBps) >= 45
            ? "watch"
            : "normal";
      return {
        ...ticker,
        premiumUsd,
        premiumBps,
        robustZScore,
        ageMs,
        state,
      };
    })
    .sort((a, b) => Math.abs(b.premiumBps) - Math.abs(a.premiumBps));
  const outlierCount = venues.filter((venue) => venue.state === "outlier").length;
  const staleCount = venues.filter((venue) => venue.state === "stale").length;
  const normalCount = venues.filter((venue) => venue.state === "normal").length;
  const maxPremiumBps = venues.reduce((max, venue) => Math.max(max, Math.abs(venue.premiumBps)), 0);
  const confidence = tickers.length >= 5 && outlierCount === 0 && staleCount === 0
    ? "high"
    : tickers.length >= 3 && outlierCount <= 1
      ? "medium"
      : "low";

  return {
    generatedAt,
    consensusPriceUsd,
    medianAbsoluteDeviationUsd,
    venues,
    summary: {
      venueCount: tickers.length,
      normalCount,
      outlierCount,
      staleCount,
      maxPremiumBps,
      confidence,
    },
    explanation: `consensus = median(${tickers.length} public BTC tickers); robust_z = premium / (MAD * 1.4826)`,
    sources: uniqueStrings(tickers.map((ticker) => ticker.source)),
    errors: input.errors ?? [],
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2
    : values[middle] ?? 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

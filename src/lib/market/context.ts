import { estimateRealizedVolBpsPerSecond } from "./quant";

export type MarketContext = {
  fetchedAt: number;
  volatility: {
    source: "binance-klines" | "kraken-ohlc";
    intervalSeconds: number;
    realizedVolBpsPerSecond: number;
    closes: number[];
  };
  binance24h?: {
    lastPrice: number;
    priceChangePercent: number;
    volumeBtc: number;
    quoteVolumeUsd: number;
  };
  mempoolFees?: {
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
  };
  coingecko?: {
    currentPriceUsd: number;
    totalVolumeUsd: number;
    high24h: number;
    low24h: number;
    priceChangePercent24h: number;
    lastUpdated: string;
  };
  sentiment?: {
    value: number;
    label: string;
    timestamp: number;
  };
  sources: string[];
  errors: string[];
};

export function parseBinanceKlines(payload: unknown): number[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((row) => {
      if (!Array.isArray(row)) return undefined;
      const close = Number(row[4]);
      return Number.isFinite(close) && close > 0 ? close : undefined;
    })
    .filter((value): value is number => value !== undefined);
}

export function parseKrakenOhlc(payload: unknown): number[] {
  if (!isRecord(payload) || !isRecord(payload.result)) return [];
  const series = Object.entries(payload.result).find(([key, value]) => key !== "last" && Array.isArray(value))?.[1];
  if (!Array.isArray(series)) return [];
  return series
    .map((row) => {
      if (!Array.isArray(row)) return undefined;
      const close = Number(row[4]);
      return Number.isFinite(close) && close > 0 ? close : undefined;
    })
    .filter((value): value is number => value !== undefined);
}

export function buildMarketContext(input: {
  klines: unknown;
  krakenOhlc?: unknown;
  ticker24h?: unknown;
  mempoolFees?: unknown;
  coingeckoMarkets?: unknown;
  alternativeFearGreed?: unknown;
  errors?: string[];
}): MarketContext {
  const binanceCloses = parseBinanceKlines(input.klines);
  const krakenCloses = parseKrakenOhlc(input.krakenOhlc);
  const usingBinance = binanceCloses.length >= 3;
  const closes = usingBinance ? binanceCloses : krakenCloses;
  return {
    fetchedAt: Date.now(),
    volatility: {
      source: usingBinance ? "binance-klines" : "kraken-ohlc",
      intervalSeconds: 60,
      realizedVolBpsPerSecond: estimateRealizedVolBpsPerSecond(closes, 60),
      closes,
    },
    binance24h: parseBinance24h(input.ticker24h),
    mempoolFees: parseMempoolFees(input.mempoolFees),
    coingecko: parseCoinGecko(input.coingeckoMarkets),
    sentiment: parseAlternativeFearGreed(input.alternativeFearGreed),
    sources: [
      "https://api.binance.com/api/v3/klines",
      "https://api.binance.com/api/v3/ticker/24hr",
      "https://api.kraken.com/0/public/OHLC",
      "https://mempool.space/api/v1/fees/recommended",
      "https://api.coingecko.com/api/v3/coins/markets",
      "https://api.alternative.me/fng/",
    ],
    errors: input.errors ?? [],
  };
}

function parseAlternativeFearGreed(payload: unknown): MarketContext["sentiment"] {
  if (!isRecord(payload) || !Array.isArray(payload.data) || !isRecord(payload.data[0])) return undefined;
  const entry = payload.data[0];
  return {
    value: numberValue(entry.value),
    label: String(entry.value_classification ?? "unknown"),
    timestamp: numberValue(entry.timestamp),
  };
}

function parseBinance24h(payload: unknown): MarketContext["binance24h"] {
  if (!isRecord(payload)) return undefined;
  return {
    lastPrice: numberValue(payload.lastPrice),
    priceChangePercent: numberValue(payload.priceChangePercent),
    volumeBtc: numberValue(payload.volume),
    quoteVolumeUsd: numberValue(payload.quoteVolume),
  };
}

function parseMempoolFees(payload: unknown): MarketContext["mempoolFees"] {
  if (!isRecord(payload)) return undefined;
  return {
    fastestFee: numberValue(payload.fastestFee),
    halfHourFee: numberValue(payload.halfHourFee),
    hourFee: numberValue(payload.hourFee),
    economyFee: numberValue(payload.economyFee),
    minimumFee: numberValue(payload.minimumFee),
  };
}

function parseCoinGecko(payload: unknown): MarketContext["coingecko"] {
  if (!Array.isArray(payload) || !isRecord(payload[0])) return undefined;
  const entry = payload[0];
  return {
    currentPriceUsd: numberValue(entry.current_price),
    totalVolumeUsd: numberValue(entry.total_volume),
    high24h: numberValue(entry.high_24h),
    low24h: numberValue(entry.low_24h),
    priceChangePercent24h: numberValue(entry.price_change_percentage_24h),
    lastUpdated: String(entry.last_updated ?? ""),
  };
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

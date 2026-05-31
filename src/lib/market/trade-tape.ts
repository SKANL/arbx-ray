import type { QuoteAsset } from "./types";

export type TapeExchangeId = "coinbase" | "kraken";
export type TapeSide = "buy" | "sell";

export type TapeTrade = {
  exchangeId: TapeExchangeId;
  symbol: string;
  quoteAsset: QuoteAsset;
  tradeId: string;
  price: number;
  sizeBtc: number;
  notionalUsd: number;
  timestamp: number;
  receivedAt: number;
  makerSide: TapeSide;
  aggressorSide: TapeSide;
};

export type TradeTapeVenueSummary = {
  exchangeId: TapeExchangeId;
  symbol: string;
  tradeCount: number;
  buyAggressorBtc: number;
  sellAggressorBtc: number;
  signedVolumeBtc: number;
  imbalance: number;
  tradesPerMinute: number;
  averageTradeBtc: number;
  priceDriftBps: number;
  firstPrice: number;
  lastPrice: number;
  toxicityScore: number;
  state: "benign" | "watch" | "toxic";
  recommendation: "allow" | "cap-size" | "halt-fast-flow";
  explanation: string;
};

export type TradeTapeToxicity = {
  generatedAt: number;
  windowMs: number;
  venues: TradeTapeVenueSummary[];
  summary: {
    venueCount: number;
    tradeCount: number;
    combinedScore: number;
    toxicVenues: number;
    watchVenues: number;
    recommendation: "allow" | "cap-size" | "halt-fast-flow";
  };
  sources: string[];
  errors: string[];
};

export function parseCoinbaseTrades(payload: unknown, receivedAt = Date.now()): TapeTrade[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((row): TapeTrade | undefined => {
      if (!isRecord(row)) return undefined;
      const price = numberValue(row.price);
      const sizeBtc = numberValue(row.size);
      const timestamp = typeof row.time === "string" ? Date.parse(row.time) : Number.NaN;
      const makerSide = row.side === "buy" || row.side === "sell" ? row.side : undefined;
      if (!makerSide || !isFinitePositive(price) || !isFinitePositive(sizeBtc) || !Number.isFinite(timestamp)) {
        return undefined;
      }
      const aggressorSide = oppositeSide(makerSide);
      return {
        exchangeId: "coinbase",
        symbol: "BTC-USD",
        quoteAsset: "USD",
        tradeId: String(row.trade_id ?? `${timestamp}-${price}-${sizeBtc}`),
        price,
        sizeBtc,
        notionalUsd: price * sizeBtc,
        timestamp,
        receivedAt,
        makerSide,
        aggressorSide,
      };
    })
    .filter((trade): trade is TapeTrade => Boolean(trade));
}

export function parseKrakenTrades(payload: unknown, receivedAt = Date.now()): TapeTrade[] {
  if (!isRecord(payload) || !isRecord(payload.result)) return [];
  const tradeRows = Object.entries(payload.result)
    .filter(([key, value]) => key !== "last" && Array.isArray(value))
    .flatMap(([, value]) => value as unknown[]);

  return tradeRows
    .map((row): TapeTrade | undefined => {
      if (!Array.isArray(row)) return undefined;
      const price = numberValue(row[0]);
      const sizeBtc = numberValue(row[1]);
      const timestamp = numberValue(row[2]) * 1_000;
      const aggressorSide = row[3] === "b" ? "buy" : row[3] === "s" ? "sell" : undefined;
      if (!aggressorSide || !isFinitePositive(price) || !isFinitePositive(sizeBtc) || !Number.isFinite(timestamp)) {
        return undefined;
      }
      return {
        exchangeId: "kraken",
        symbol: "BTC/USD",
        quoteAsset: "USD",
        tradeId: String(row[6] ?? `${timestamp}-${price}-${sizeBtc}`),
        price,
        sizeBtc,
        notionalUsd: price * sizeBtc,
        timestamp,
        receivedAt,
        makerSide: oppositeSide(aggressorSide),
        aggressorSide,
      };
    })
    .filter((trade): trade is TapeTrade => Boolean(trade));
}

export function buildTradeTapeToxicity(input: {
  tradesByVenue: Partial<Record<TapeExchangeId, TapeTrade[]>>;
  observedAt?: number;
  sources?: string[];
  errors?: string[];
}): TradeTapeToxicity {
  const generatedAt = input.observedAt ?? Date.now();
  const venues = (Object.entries(input.tradesByVenue) as Array<[TapeExchangeId, TapeTrade[] | undefined]>)
    .map(([exchangeId, trades]) => summarizeVenue(exchangeId, trades ?? [], generatedAt))
    .filter((summary): summary is TradeTapeVenueSummary => Boolean(summary));
  const tradeCount = venues.reduce((sum, venue) => sum + venue.tradeCount, 0);
  const combinedScore = venues.length
    ? venues.reduce((sum, venue) => sum + venue.toxicityScore * venue.tradeCount, 0) / Math.max(1, tradeCount)
    : 0;
  const recommendation = combinedScore >= 70
    ? "halt-fast-flow"
    : combinedScore >= 40 || venues.some((venue) => venue.recommendation === "cap-size")
      ? "cap-size"
      : "allow";

  return {
    generatedAt,
    windowMs: combinedWindowMs(venues),
    venues,
    summary: {
      venueCount: venues.length,
      tradeCount,
      combinedScore,
      toxicVenues: venues.filter((venue) => venue.state === "toxic").length,
      watchVenues: venues.filter((venue) => venue.state === "watch").length,
      recommendation,
    },
    sources: uniqueStrings(input.sources ?? []),
    errors: input.errors ?? [],
  };
}

function summarizeVenue(
  exchangeId: TapeExchangeId,
  trades: TapeTrade[],
  observedAt: number,
): TradeTapeVenueSummary | undefined {
  const validTrades = trades
    .filter((trade) => trade.exchangeId === exchangeId && isFinitePositive(trade.price) && isFinitePositive(trade.sizeBtc))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (validTrades.length === 0) return undefined;

  const first = validTrades[0];
  const last = validTrades[validTrades.length - 1];
  const buyAggressorBtc = validTrades
    .filter((trade) => trade.aggressorSide === "buy")
    .reduce((sum, trade) => sum + trade.sizeBtc, 0);
  const sellAggressorBtc = validTrades
    .filter((trade) => trade.aggressorSide === "sell")
    .reduce((sum, trade) => sum + trade.sizeBtc, 0);
  const totalVolumeBtc = buyAggressorBtc + sellAggressorBtc;
  const signedVolumeBtc = buyAggressorBtc - sellAggressorBtc;
  const imbalance = totalVolumeBtc > 0 ? signedVolumeBtc / totalVolumeBtc : 0;
  const windowMs = Math.max(15_000, last.timestamp - first.timestamp, observedAt - first.timestamp);
  const tradesPerMinute = validTrades.length / (windowMs / 60_000);
  const averageTradeBtc = totalVolumeBtc / validTrades.length;
  const priceDriftBps = first.price > 0 ? ((last.price - first.price) / first.price) * 10_000 : 0;
  const alignedFastFlow =
    Math.sign(signedVolumeBtc) !== 0 &&
    Math.sign(priceDriftBps) !== 0 &&
    Math.sign(signedVolumeBtc) === Math.sign(priceDriftBps);
  const toxicityScore = clamp(
    Math.abs(imbalance) * 45 +
      Math.min(30, Math.abs(priceDriftBps) * 1.6) +
      Math.min(15, tradesPerMinute * 0.75) +
      Math.min(10, averageTradeBtc * 20) +
      (alignedFastFlow ? 15 : -8),
    0,
    100,
  );
  const state = toxicityScore >= 70 ? "toxic" : toxicityScore >= 40 ? "watch" : "benign";
  const recommendation = state === "toxic" ? "halt-fast-flow" : state === "watch" ? "cap-size" : "allow";
  const dominantSide = signedVolumeBtc > 0 ? "buy" : signedVolumeBtc < 0 ? "sell" : "balanced";

  return {
    exchangeId,
    symbol: first.symbol,
    tradeCount: validTrades.length,
    buyAggressorBtc,
    sellAggressorBtc,
    signedVolumeBtc,
    imbalance,
    tradesPerMinute,
    averageTradeBtc,
    priceDriftBps,
    firstPrice: first.price,
    lastPrice: last.price,
    toxicityScore,
    state,
    recommendation,
    explanation:
      `dominant ${dominantSide} flow ${signedVolumeBtc.toFixed(4)} BTC, ` +
      `drift ${priceDriftBps.toFixed(2)} bps, ` +
      `${tradesPerMinute.toFixed(1)} trades/min`,
  };
}

function combinedWindowMs(venues: TradeTapeVenueSummary[]) {
  if (venues.length === 0) return 0;
  return Math.round(
    venues.reduce((sum, venue) => sum + (venue.tradeCount / Math.max(0.1, venue.tradesPerMinute)) * 60_000, 0) /
      venues.length,
  );
}

function oppositeSide(side: TapeSide): TapeSide {
  return side === "buy" ? "sell" : "buy";
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

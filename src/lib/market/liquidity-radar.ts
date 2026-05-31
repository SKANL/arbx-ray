import { defaultEngineConfig } from "./defaults";
import { simulateMarketFill } from "./execution";
import type { OrderBookLevel, OrderBookSnapshot, QuoteAsset } from "./types";

export type LiquidityVenueBook = OrderBookSnapshot & {
  topBid: number;
  topAsk: number;
  spreadBps: number;
  bidDepthBtc: number;
  askDepthBtc: number;
};

export type LiquidityRoute = {
  buyExchange: string;
  sellExchange: string;
  quoteAsset: QuoteAsset;
  tradeSizeBtc: number;
  complete: boolean;
  grossProfitUsd: number;
  feeCostUsd: number;
  rebalanceCostUsd: number;
  latencyCostUsd: number;
  netProfitUsd: number;
  edgeBps: number;
  buyVwap: number;
  sellVwap: number;
  routeScore: number;
  rejectionReasons: string[];
};

export type LiquidityFrontierPoint = {
  sizeBtc: number;
  bestNetProfitUsd: number;
  bestRoute?: string;
  executableRoutes: number;
};

export type LiquidityRadar = {
  generatedAt: number;
  targetSizeBtc: number;
  books: LiquidityVenueBook[];
  routes: LiquidityRoute[];
  frontier: LiquidityFrontierPoint[];
  summary: {
    venuesLoaded: number;
    usdVenues: number;
    usdtVenues: number;
    routeCount: number;
    executableRoutes: number;
    bestNetProfitUsd: number;
    medianSpreadBps: number;
    sourceCount: number;
  };
  sources: string[];
  errors: string[];
};

export function buildLiquidityRadar(input: {
  books: Array<OrderBookSnapshot | undefined>;
  targetSizeBtc?: number;
  observedAt?: number;
  sources?: string[];
  errors?: string[];
}): LiquidityRadar {
  const generatedAt = input.observedAt ?? Date.now();
  const targetSizeBtc = input.targetSizeBtc ?? 0.35;
  const books = input.books
    .filter((book): book is OrderBookSnapshot => Boolean(book))
    .map(enrichBook)
    .filter((book) => book.bids.length > 0 && book.asks.length > 0);
  const routes = buildRoutes(books, targetSizeBtc, generatedAt);
  const spreads = books.map((book) => book.spreadBps).sort((a, b) => a - b);

  return {
    generatedAt,
    targetSizeBtc,
    books,
    routes,
    frontier: buildFrontier(books, targetSizeBtc, generatedAt),
    summary: {
      venuesLoaded: books.length,
      usdVenues: books.filter((book) => book.quoteAsset === "USD").length,
      usdtVenues: books.filter((book) => book.quoteAsset === "USDT").length,
      routeCount: routes.length,
      executableRoutes: routes.filter((route) => route.complete && route.rejectionReasons.length === 0).length,
      bestNetProfitUsd: routes[0]?.netProfitUsd ?? 0,
      medianSpreadBps: median(spreads),
      sourceCount: uniqueStrings(input.sources ?? []).length,
    },
    sources: uniqueStrings(input.sources ?? []),
    errors: input.errors ?? [],
  };
}

export function parseCoinbaseRestBook(payload: unknown, receivedAt = Date.now()): OrderBookSnapshot | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.bids) || !Array.isArray(payload.asks)) return undefined;
  const bids = parseNestedLevels(payload.bids).sort(descPrice);
  const asks = parseNestedLevels(payload.asks).sort(ascPrice);
  if (bids.length === 0 || asks.length === 0) return undefined;
  return {
    exchangeId: "coinbase",
    symbol: "BTC-USD",
    baseAsset: "BTC",
    quoteAsset: "USD",
    bids,
    asks,
    receivedAt,
    sequence: numberOrUndefined(payload.sequence),
  };
}

export function parseKrakenDepthBook(payload: unknown, receivedAt = Date.now()): OrderBookSnapshot | undefined {
  if (!isRecord(payload) || !isRecord(payload.result)) return undefined;
  const rawBook = Object.values(payload.result).find(isRecord);
  if (!rawBook || !Array.isArray(rawBook.bids) || !Array.isArray(rawBook.asks)) return undefined;
  const bids = parseNestedLevels(rawBook.bids).sort(descPrice);
  const asks = parseNestedLevels(rawBook.asks).sort(ascPrice);
  if (bids.length === 0 || asks.length === 0) return undefined;
  return {
    exchangeId: "kraken",
    symbol: "BTC/USD",
    baseAsset: "BTC",
    quoteAsset: "USD",
    bids,
    asks,
    receivedAt,
  };
}

export function parseBitstampBook(payload: unknown, receivedAt = Date.now()): OrderBookSnapshot | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.bids) || !Array.isArray(payload.asks)) return undefined;
  const bids = parseNestedLevels(payload.bids).sort(descPrice);
  const asks = parseNestedLevels(payload.asks).sort(ascPrice);
  if (bids.length === 0 || asks.length === 0) return undefined;
  return {
    exchangeId: "bitstamp",
    symbol: "btcusd",
    baseAsset: "BTC",
    quoteAsset: "USD",
    bids,
    asks,
    receivedAt,
    exchangeTimestamp: numberOrUndefined(payload.timestamp),
  };
}

export function parseBitfinexBook(payload: unknown, receivedAt = Date.now()): OrderBookSnapshot | undefined {
  if (!Array.isArray(payload)) return undefined;
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];
  for (const row of payload) {
    if (!Array.isArray(row)) continue;
    const price = numberValue(row[0]);
    const count = numberValue(row[1]);
    const amount = numberValue(row[2]);
    if (price <= 0 || count <= 0 || amount === 0) continue;
    if (amount > 0) bids.push({ price, size: amount });
    if (amount < 0) asks.push({ price, size: Math.abs(amount) });
  }
  bids.sort(descPrice);
  asks.sort(ascPrice);
  if (bids.length === 0 || asks.length === 0) return undefined;
  return {
    exchangeId: "bitfinex",
    symbol: "tBTCUSD",
    baseAsset: "BTC",
    quoteAsset: "USD",
    bids,
    asks,
    receivedAt,
  };
}

export function parseOkxBook(payload: unknown, receivedAt = Date.now()): OrderBookSnapshot | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data) || !isRecord(payload.data[0])) return undefined;
  const entry = payload.data[0];
  if (!Array.isArray(entry.bids) || !Array.isArray(entry.asks)) return undefined;
  const bids = parseNestedLevels(entry.bids).sort(descPrice);
  const asks = parseNestedLevels(entry.asks).sort(ascPrice);
  if (bids.length === 0 || asks.length === 0) return undefined;
  return {
    exchangeId: "okx",
    symbol: "BTC-USDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    bids,
    asks,
    receivedAt,
    exchangeTimestamp: numberOrUndefined(entry.ts),
  };
}

export function parseGeminiBook(payload: unknown, receivedAt = Date.now()): OrderBookSnapshot | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.bids) || !Array.isArray(payload.asks)) return undefined;
  const bids = parseObjectLevels(payload.bids, "amount").sort(descPrice);
  const asks = parseObjectLevels(payload.asks, "amount").sort(ascPrice);
  if (bids.length === 0 || asks.length === 0) return undefined;
  return {
    exchangeId: "gemini",
    symbol: "btcusd",
    baseAsset: "BTC",
    quoteAsset: "USD",
    bids,
    asks,
    receivedAt,
  };
}

export function parseKuCoinBook(payload: unknown, receivedAt = Date.now()): OrderBookSnapshot | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const data = payload.data;
  if (!Array.isArray(data.bids) || !Array.isArray(data.asks)) return undefined;
  const bids = parseNestedLevels(data.bids).sort(descPrice);
  const asks = parseNestedLevels(data.asks).sort(ascPrice);
  if (bids.length === 0 || asks.length === 0) return undefined;
  return {
    exchangeId: "kucoin",
    symbol: "BTC-USDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    bids,
    asks,
    receivedAt,
    sequence: numberOrUndefined(data.sequence),
  };
}

function buildRoutes(books: LiquidityVenueBook[], targetSizeBtc: number, observedAt: number): LiquidityRoute[] {
  const routes: LiquidityRoute[] = [];
  for (const buyBook of books) {
    for (const sellBook of books) {
      if (buyBook.exchangeId === sellBook.exchangeId) continue;
      if (buyBook.quoteAsset !== sellBook.quoteAsset) continue;
      routes.push(simulateLiquidityRoute(buyBook, sellBook, targetSizeBtc, observedAt));
    }
  }
  return routes.sort((a, b) => b.routeScore - a.routeScore || b.netProfitUsd - a.netProfitUsd);
}

function simulateLiquidityRoute(
  buyBook: LiquidityVenueBook,
  sellBook: LiquidityVenueBook,
  targetSizeBtc: number,
  observedAt: number,
): LiquidityRoute {
  const buyFill = simulateMarketFill(buyBook.asks, targetSizeBtc);
  const sellFill = simulateMarketFill(sellBook.bids, targetSizeBtc);
  const tradeSizeBtc = Math.min(buyFill.filledBtc, sellFill.filledBtc, targetSizeBtc);
  const adjustedBuy = tradeSizeBtc === buyFill.filledBtc ? buyFill : simulateMarketFill(buyBook.asks, tradeSizeBtc);
  const adjustedSell = tradeSizeBtc === sellFill.filledBtc ? sellFill : simulateMarketFill(sellBook.bids, tradeSizeBtc);
  const grossProfitUsd = adjustedSell.notional - adjustedBuy.notional;
  const feeCostUsd =
    adjustedBuy.notional * feeRate(buyBook.exchangeId) +
    adjustedSell.notional * feeRate(sellBook.exchangeId);
  const referencePrice = adjustedBuy.vwap || adjustedSell.vwap || buyBook.topAsk || sellBook.topBid;
  const rebalanceCostUsd = defaultEngineConfig.withdrawalFeeBtc * referencePrice;
  const ageMs = Math.max(0, observedAt - buyBook.receivedAt, observedAt - sellBook.receivedAt);
  const latencyCostUsd =
    adjustedSell.notional *
    (defaultEngineConfig.latencyVolatilityBpsPerSecond / 10_000) *
    (ageMs / 1_000);
  const netProfitUsd = grossProfitUsd - feeCostUsd - rebalanceCostUsd - latencyCostUsd;
  const notional = Math.max(adjustedBuy.notional, adjustedSell.notional, referencePrice * tradeSizeBtc);
  const edgeBps = notional > 0 ? (netProfitUsd / notional) * 10_000 : 0;
  const rejectionReasons: string[] = [];
  if (buyBook.topAsk >= sellBook.topBid) rejectionReasons.push("No positive top-of-book spread");
  if (!buyFill.complete || !sellFill.complete || tradeSizeBtc < targetSizeBtc) {
    rejectionReasons.push("Insufficient executable depth");
  }
  if (netProfitUsd <= 0) rejectionReasons.push("Negative net route after costs");

  return {
    buyExchange: buyBook.exchangeId,
    sellExchange: sellBook.exchangeId,
    quoteAsset: buyBook.quoteAsset,
    tradeSizeBtc,
    complete: rejectionReasons.length === 0,
    grossProfitUsd,
    feeCostUsd,
    rebalanceCostUsd,
    latencyCostUsd,
    netProfitUsd,
    edgeBps,
    buyVwap: adjustedBuy.vwap,
    sellVwap: adjustedSell.vwap,
    routeScore: scoreRoute(netProfitUsd, edgeBps, tradeSizeBtc, targetSizeBtc, rejectionReasons),
    rejectionReasons,
  };
}

function buildFrontier(
  books: LiquidityVenueBook[],
  targetSizeBtc: number,
  observedAt: number,
): LiquidityFrontierPoint[] {
  const sizes = uniqueNumbers([0.05, 0.1, 0.25, 0.5, targetSizeBtc])
    .filter((size) => size > 0 && size <= Math.max(targetSizeBtc, 0.5))
    .sort((a, b) => a - b);
  return sizes.map((sizeBtc) => {
    const routes = buildRoutes(books, sizeBtc, observedAt);
    const best = routes[0];
    return {
      sizeBtc,
      bestNetProfitUsd: best?.netProfitUsd ?? 0,
      bestRoute: best ? `${best.buyExchange}->${best.sellExchange}` : undefined,
      executableRoutes: routes.filter((route) => route.complete).length,
    };
  });
}

function enrichBook(book: OrderBookSnapshot): LiquidityVenueBook {
  const topBid = book.bids[0]?.price ?? 0;
  const topAsk = book.asks[0]?.price ?? 0;
  const mid = topBid > 0 && topAsk > 0 ? (topBid + topAsk) / 2 : 0;
  return {
    ...book,
    topBid,
    topAsk,
    spreadBps: mid > 0 ? ((topAsk - topBid) / mid) * 10_000 : 0,
    bidDepthBtc: book.bids.reduce((sum, level) => sum + level.size, 0),
    askDepthBtc: book.asks.reduce((sum, level) => sum + level.size, 0),
  };
}

function parseNestedLevels(rows: unknown[]): OrderBookLevel[] {
  return rows
    .map((row) => {
      if (!Array.isArray(row)) return undefined;
      const price = numberValue(row[0]);
      const size = numberValue(row[1]);
      if (price <= 0 || size <= 0) return undefined;
      return { price, size };
    })
    .filter((item): item is OrderBookLevel => Boolean(item));
}

function parseObjectLevels(rows: unknown[], sizeKey: string): OrderBookLevel[] {
  return rows
    .map((row) => {
      if (!isRecord(row)) return undefined;
      const price = numberValue(row.price);
      const size = numberValue(row[sizeKey]);
      if (price <= 0 || size <= 0) return undefined;
      return { price, size };
    })
    .filter((item): item is OrderBookLevel => Boolean(item));
}

function scoreRoute(
  netProfitUsd: number,
  edgeBps: number,
  tradeSizeBtc: number,
  targetSizeBtc: number,
  rejectionReasons: string[],
): number {
  const depthCompletion = targetSizeBtc > 0 ? tradeSizeBtc / targetSizeBtc : 0;
  const base = 55 + Math.max(-30, Math.min(30, edgeBps * 2)) + Math.min(20, Math.max(0, netProfitUsd / 5));
  return clamp(base + depthCompletion * 15 - rejectionReasons.length * 25, 0, 100);
}

function feeRate(exchangeId: string): number {
  return (defaultEngineConfig.feesBps[exchangeId] ?? 25) / 10_000;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2
    : values[middle] ?? 0;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter(Number.isFinite))];
}

function ascPrice(a: OrderBookLevel, b: OrderBookLevel): number {
  return a.price - b.price;
}

function descPrice(a: OrderBookLevel, b: OrderBookLevel): number {
  return b.price - a.price;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

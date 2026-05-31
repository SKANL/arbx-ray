import type { OrderBookLevel } from "./types";

export type MexicoPair = "BTC-USD" | "btc_mxn" | "usd_mxn";
export type MexicoAsset = "BTC" | "USD" | "MXN";

export type MexicoBook = {
  exchangeId: "coinbase" | "bitso";
  pair: MexicoPair;
  baseAsset: MexicoAsset;
  quoteAsset: MexicoAsset;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  receivedAt: number;
  sequence?: number;
  exchangeTimestamp?: number;
};

export type MexicoCorridorLeg = {
  venue: "coinbase" | "bitso";
  pair: MexicoPair;
  action: "buy-btc" | "sell-btc" | "buy-usd" | "sell-usd";
  inputAsset: MexicoAsset;
  outputAsset: MexicoAsset;
  inputAmount: number;
  outputAmount: number;
  feeAmount: number;
  vwap: number;
  complete: boolean;
  levelsUsed: number;
};

export type MexicoCorridorRoute = {
  id: "coinbase-usd-to-bitso-mxn" | "bitso-mxn-to-coinbase-usd";
  label: string;
  tradeSizeBtc: number;
  startUsd: number;
  finalUsd: number;
  grossEdgeUsd: number;
  feeCostUsd: number;
  rebalanceCostUsd: number;
  netPnlUsd: number;
  netPnlBps: number;
  complete: boolean;
  routeScore: number;
  rejectionReasons: string[];
  legs: MexicoCorridorLeg[];
  explanation: string;
};

export type MexicoCorridorLab = {
  generatedAt: number;
  targetSizeBtc: number;
  routes: MexicoCorridorRoute[];
  bestRoute?: MexicoCorridorRoute;
  books: Record<MexicoPair, { bid: number; ask: number; bidSize: number; askSize: number; sequence?: number }>;
  summary: {
    executableRoutes: number;
    bestNetPnlUsd: number;
    bestRouteLabel: string;
    impliedUsdMxnBid: number;
    impliedUsdMxnAsk: number;
  };
  assumptions: {
    coinbaseFeeBps: number;
    bitsoFeeBps: number;
    fxFeeBps: number;
    rebalanceCostUsd: number;
  };
  sources: string[];
  errors: string[];
};

type FeeConfig = {
  coinbase: number;
  bitso: number;
  fx: number;
};

export function parseBitsoOrderBook(
  pair: "btc_mxn" | "usd_mxn",
  payload: unknown,
  receivedAt = Date.now(),
): MexicoBook | undefined {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.payload)) return undefined;
  const body = payload.payload;
  if (!Array.isArray(body.bids) || !Array.isArray(body.asks)) return undefined;
  const bids = parseBitsoLevels(body.bids).sort(descPrice);
  const asks = parseBitsoLevels(body.asks).sort(ascPrice);
  if (bids.length === 0 || asks.length === 0) return undefined;
  return {
    exchangeId: "bitso",
    pair,
    baseAsset: pair === "btc_mxn" ? "BTC" : "USD",
    quoteAsset: "MXN",
    bids,
    asks,
    receivedAt,
    sequence: numberOrUndefined(body.sequence),
    exchangeTimestamp: typeof body.updated_at === "string" ? Date.parse(body.updated_at) : undefined,
  };
}

export function parseCoinbaseUsdBook(payload: unknown, receivedAt = Date.now()): MexicoBook | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.bids) || !Array.isArray(payload.asks)) return undefined;
  const bids = parseNestedLevels(payload.bids).sort(descPrice);
  const asks = parseNestedLevels(payload.asks).sort(ascPrice);
  if (bids.length === 0 || asks.length === 0) return undefined;
  return {
    exchangeId: "coinbase",
    pair: "BTC-USD",
    baseAsset: "BTC",
    quoteAsset: "USD",
    bids,
    asks,
    receivedAt,
    sequence: numberOrUndefined(payload.sequence),
  };
}

export function buildMexicoCorridorLab(input: {
  coinbaseBtcUsd?: MexicoBook;
  bitsoBtcMxn?: MexicoBook;
  bitsoUsdMxn?: MexicoBook;
  targetSizeBtc?: number;
  feeBps?: Partial<FeeConfig>;
  rebalanceCostUsd?: number;
  observedAt?: number;
  sources?: string[];
  errors?: string[];
}): MexicoCorridorLab {
  const targetSizeBtc = input.targetSizeBtc ?? 0.25;
  const feeBps: FeeConfig = {
    coinbase: input.feeBps?.coinbase ?? 60,
    bitso: input.feeBps?.bitso ?? 65,
    fx: input.feeBps?.fx ?? 50,
  };
  const rebalanceCostUsd = input.rebalanceCostUsd ?? 18;
  const errors = [...(input.errors ?? [])];
  if (!input.coinbaseBtcUsd) errors.push("Coinbase BTC-USD book unavailable");
  if (!input.bitsoBtcMxn) errors.push("Bitso BTC/MXN book unavailable");
  if (!input.bitsoUsdMxn) errors.push("Bitso USD/MXN book unavailable");

  const routes =
    input.coinbaseBtcUsd && input.bitsoBtcMxn && input.bitsoUsdMxn
      ? [
          simulateCoinbaseToBitso(input.coinbaseBtcUsd, input.bitsoBtcMxn, input.bitsoUsdMxn, targetSizeBtc, feeBps, rebalanceCostUsd),
          simulateBitsoToCoinbase(input.coinbaseBtcUsd, input.bitsoBtcMxn, input.bitsoUsdMxn, targetSizeBtc, feeBps, rebalanceCostUsd),
        ]
      : [];
  const rankedRoutes = [...routes].sort((a, b) => b.routeScore - a.routeScore || b.netPnlUsd - a.netPnlUsd);
  const bestRoute = rankedRoutes[0];

  return {
    generatedAt: input.observedAt ?? Date.now(),
    targetSizeBtc,
    routes: rankedRoutes,
    bestRoute,
    books: {
      "BTC-USD": summarizeBook(input.coinbaseBtcUsd),
      btc_mxn: summarizeBook(input.bitsoBtcMxn),
      usd_mxn: summarizeBook(input.bitsoUsdMxn),
    },
    summary: {
      executableRoutes: routes.filter((route) => route.complete && route.netPnlUsd > 0).length,
      bestNetPnlUsd: bestRoute?.netPnlUsd ?? 0,
      bestRouteLabel: bestRoute?.label ?? "unavailable",
      impliedUsdMxnBid: input.bitsoUsdMxn?.bids[0]?.price ?? 0,
      impliedUsdMxnAsk: input.bitsoUsdMxn?.asks[0]?.price ?? 0,
    },
    assumptions: {
      coinbaseFeeBps: feeBps.coinbase,
      bitsoFeeBps: feeBps.bitso,
      fxFeeBps: feeBps.fx,
      rebalanceCostUsd,
    },
    sources: uniqueStrings(input.sources ?? []),
    errors,
  };
}

function simulateCoinbaseToBitso(
  coinbaseBtcUsd: MexicoBook,
  bitsoBtcMxn: MexicoBook,
  bitsoUsdMxn: MexicoBook,
  targetSizeBtc: number,
  feeBps: FeeConfig,
  rebalanceCostUsd: number,
): MexicoCorridorRoute {
  const buyBtc = buyBaseWithQuote({
    venue: "coinbase",
    pair: "BTC-USD",
    asks: coinbaseBtcUsd.asks,
    quoteAmount: Number.POSITIVE_INFINITY,
    maxBase: targetSizeBtc,
    inputAsset: "USD",
    outputAsset: "BTC",
    action: "buy-btc",
    feeBps: feeBps.coinbase,
  });
  const sellBtc = sellBaseForQuote({
    venue: "bitso",
    pair: "btc_mxn",
    bids: bitsoBtcMxn.bids,
    baseAmount: buyBtc.outputAmount,
    inputAsset: "BTC",
    outputAsset: "MXN",
    action: "sell-btc",
    feeBps: feeBps.bitso,
  });
  const buyUsd = buyBaseWithQuote({
    venue: "bitso",
    pair: "usd_mxn",
    asks: bitsoUsdMxn.asks,
    quoteAmount: sellBtc.outputAmount,
    inputAsset: "MXN",
    outputAsset: "USD",
    action: "buy-usd",
    feeBps: feeBps.fx,
  });
  const rejectionReasons = routeRejections([buyBtc, sellBtc, buyUsd]);
  if (!buyUsd.complete) rejectionReasons.push("Insufficient USD/MXN ask depth to convert MXN proceeds");
  const feeCostUsd = buyBtc.feeAmount * buyBtc.vwap + sellBtc.feeAmount / Math.max(1e-9, buyUsd.vwap) + buyUsd.feeAmount;
  return routeFromLegs({
    id: "coinbase-usd-to-bitso-mxn",
    label: "Coinbase USD → Bitso MXN → USD",
    tradeSizeBtc: Math.min(targetSizeBtc, buyBtc.outputAmount, sellBtc.inputAmount),
    startUsd: buyBtc.inputAmount,
    finalUsd: buyUsd.outputAmount,
    feeCostUsd,
    rebalanceCostUsd,
    legs: [buyBtc, sellBtc, buyUsd],
    rejectionReasons,
  });
}

function simulateBitsoToCoinbase(
  coinbaseBtcUsd: MexicoBook,
  bitsoBtcMxn: MexicoBook,
  bitsoUsdMxn: MexicoBook,
  targetSizeBtc: number,
  feeBps: FeeConfig,
  rebalanceCostUsd: number,
): MexicoCorridorRoute {
  const buyBtc = buyBaseWithQuote({
    venue: "bitso",
    pair: "btc_mxn",
    asks: bitsoBtcMxn.asks,
    quoteAmount: Number.POSITIVE_INFINITY,
    maxBase: targetSizeBtc,
    inputAsset: "MXN",
    outputAsset: "BTC",
    action: "buy-btc",
    feeBps: feeBps.bitso,
  });
  const fundMxn = sellBaseForTargetQuote({
    venue: "bitso",
    pair: "usd_mxn",
    bids: bitsoUsdMxn.bids,
    targetQuoteAmount: buyBtc.inputAmount,
    inputAsset: "USD",
    outputAsset: "MXN",
    action: "sell-usd",
    feeBps: feeBps.fx,
  });
  const sellBtc = sellBaseForQuote({
    venue: "coinbase",
    pair: "BTC-USD",
    bids: coinbaseBtcUsd.bids,
    baseAmount: buyBtc.outputAmount,
    inputAsset: "BTC",
    outputAsset: "USD",
    action: "sell-btc",
    feeBps: feeBps.coinbase,
  });
  const rejectionReasons = routeRejections([fundMxn, buyBtc, sellBtc]);
  if (!fundMxn.complete) rejectionReasons.push("Insufficient USD/MXN bid depth to fund MXN purchase");
  const feeCostUsd = fundMxn.feeAmount + buyBtc.feeAmount * (buyBtc.vwap / Math.max(1e-9, fundMxn.vwap)) + sellBtc.feeAmount;
  return routeFromLegs({
    id: "bitso-mxn-to-coinbase-usd",
    label: "USD → Bitso MXN → Coinbase USD",
    tradeSizeBtc: Math.min(targetSizeBtc, buyBtc.outputAmount, sellBtc.inputAmount),
    startUsd: fundMxn.inputAmount,
    finalUsd: sellBtc.outputAmount,
    feeCostUsd,
    rebalanceCostUsd,
    legs: [fundMxn, buyBtc, sellBtc],
    rejectionReasons,
  });
}

function buyBaseWithQuote(input: {
  venue: MexicoCorridorLeg["venue"];
  pair: MexicoPair;
  asks: OrderBookLevel[];
  quoteAmount: number;
  maxBase?: number;
  inputAsset: MexicoAsset;
  outputAsset: MexicoAsset;
  action: MexicoCorridorLeg["action"];
  feeBps: number;
}): MexicoCorridorLeg {
  let remainingQuote = input.quoteAmount;
  let grossBase = 0;
  let spentQuote = 0;
  let levelsUsed = 0;
  const maxBase = input.maxBase ?? Number.POSITIVE_INFINITY;
  for (const ask of input.asks) {
    if (remainingQuote <= 1e-12 || grossBase >= maxBase - 1e-12) break;
    const availableBase = Math.min(ask.size, maxBase - grossBase);
    const availableQuote = availableBase * ask.price;
    const quoteToSpend = Math.min(remainingQuote, availableQuote);
    if (quoteToSpend <= 0) continue;
    grossBase += quoteToSpend / ask.price;
    spentQuote += quoteToSpend;
    remainingQuote -= quoteToSpend;
    levelsUsed += 1;
  }
  const feeAmount = grossBase * (input.feeBps / 10_000);
  const outputAmount = grossBase - feeAmount;
  const complete = input.maxBase !== undefined ? grossBase >= input.maxBase - 1e-10 : remainingQuote <= 1e-8;
  return {
    venue: input.venue,
    pair: input.pair,
    action: input.action,
    inputAsset: input.inputAsset,
    outputAsset: input.outputAsset,
    inputAmount: spentQuote,
    outputAmount,
    feeAmount,
    vwap: grossBase > 0 ? spentQuote / grossBase : 0,
    complete,
    levelsUsed,
  };
}

function sellBaseForQuote(input: {
  venue: MexicoCorridorLeg["venue"];
  pair: MexicoPair;
  bids: OrderBookLevel[];
  baseAmount: number;
  inputAsset: MexicoAsset;
  outputAsset: MexicoAsset;
  action: MexicoCorridorLeg["action"];
  feeBps: number;
}): MexicoCorridorLeg {
  let remainingBase = input.baseAmount;
  let soldBase = 0;
  let grossQuote = 0;
  let levelsUsed = 0;
  for (const bid of input.bids) {
    if (remainingBase <= 1e-12) break;
    const baseToSell = Math.min(remainingBase, bid.size);
    grossQuote += baseToSell * bid.price;
    soldBase += baseToSell;
    remainingBase -= baseToSell;
    levelsUsed += 1;
  }
  const feeAmount = grossQuote * (input.feeBps / 10_000);
  return {
    venue: input.venue,
    pair: input.pair,
    action: input.action,
    inputAsset: input.inputAsset,
    outputAsset: input.outputAsset,
    inputAmount: soldBase,
    outputAmount: grossQuote - feeAmount,
    feeAmount,
    vwap: soldBase > 0 ? grossQuote / soldBase : 0,
    complete: remainingBase <= 1e-8,
    levelsUsed,
  };
}

function sellBaseForTargetQuote(input: {
  venue: MexicoCorridorLeg["venue"];
  pair: MexicoPair;
  bids: OrderBookLevel[];
  targetQuoteAmount: number;
  inputAsset: MexicoAsset;
  outputAsset: MexicoAsset;
  action: MexicoCorridorLeg["action"];
  feeBps: number;
}): MexicoCorridorLeg {
  const grossTargetQuote = input.targetQuoteAmount / Math.max(1e-9, 1 - input.feeBps / 10_000);
  let remainingQuote = grossTargetQuote;
  let soldBase = 0;
  let grossQuote = 0;
  let levelsUsed = 0;
  for (const bid of input.bids) {
    if (remainingQuote <= 1e-10) break;
    const quoteAtLevel = bid.price * bid.size;
    const quoteToReceive = Math.min(remainingQuote, quoteAtLevel);
    soldBase += quoteToReceive / bid.price;
    grossQuote += quoteToReceive;
    remainingQuote -= quoteToReceive;
    levelsUsed += 1;
  }
  const feeAmount = grossQuote * (input.feeBps / 10_000);
  return {
    venue: input.venue,
    pair: input.pair,
    action: input.action,
    inputAsset: input.inputAsset,
    outputAsset: input.outputAsset,
    inputAmount: soldBase,
    outputAmount: grossQuote - feeAmount,
    feeAmount: feeAmount / Math.max(1e-9, grossQuote / Math.max(1e-9, soldBase)),
    vwap: soldBase > 0 ? grossQuote / soldBase : 0,
    complete: remainingQuote <= 1e-8,
    levelsUsed,
  };
}

function routeFromLegs(input: {
  id: MexicoCorridorRoute["id"];
  label: string;
  tradeSizeBtc: number;
  startUsd: number;
  finalUsd: number;
  feeCostUsd: number;
  rebalanceCostUsd: number;
  legs: MexicoCorridorLeg[];
  rejectionReasons: string[];
}): MexicoCorridorRoute {
  const grossEdgeUsd = input.finalUsd - input.startUsd;
  const netPnlUsd = grossEdgeUsd - input.rebalanceCostUsd;
  if (netPnlUsd <= 0) input.rejectionReasons.push("Negative net corridor edge after costs");
  const complete = input.rejectionReasons.length === 0;
  const netPnlBps = input.startUsd > 0 ? (netPnlUsd / input.startUsd) * 10_000 : 0;
  return {
    id: input.id,
    label: input.label,
    tradeSizeBtc: input.tradeSizeBtc,
    startUsd: input.startUsd,
    finalUsd: input.finalUsd,
    grossEdgeUsd,
    feeCostUsd: input.feeCostUsd,
    rebalanceCostUsd: input.rebalanceCostUsd,
    netPnlUsd,
    netPnlBps,
    complete,
    routeScore: Math.max(0, Math.min(100, 50 + netPnlBps * 2 - input.rejectionReasons.length * 25)),
    rejectionReasons: uniqueStrings(input.rejectionReasons),
    legs: input.legs,
    explanation: `net = final_usd(${round(input.finalUsd)}) - start_usd(${round(input.startUsd)}) - rebalance(${round(input.rebalanceCostUsd)})`,
  };
}

function routeRejections(legs: MexicoCorridorLeg[]): string[] {
  const reasons: string[] = [];
  for (const leg of legs) {
    if (leg.inputAmount <= 0 || leg.outputAmount <= 0) reasons.push(`${leg.pair} produced no executable fill`);
    if (!leg.complete) reasons.push(`${leg.pair} partial fill`);
  }
  return reasons;
}

function summarizeBook(book?: MexicoBook) {
  return {
    bid: book?.bids[0]?.price ?? 0,
    ask: book?.asks[0]?.price ?? 0,
    bidSize: book?.bids[0]?.size ?? 0,
    askSize: book?.asks[0]?.size ?? 0,
    sequence: book?.sequence,
  };
}

function parseBitsoLevels(rows: unknown[]): OrderBookLevel[] {
  return rows
    .map((row) => {
      if (!isRecord(row)) return undefined;
      const price = numberValue(row.price);
      const size = numberValue(row.amount);
      if (!isFinitePositive(price) || !isFinitePositive(size)) return undefined;
      return { price, size };
    })
    .filter((level): level is OrderBookLevel => Boolean(level));
}

function parseNestedLevels(rows: unknown[]): OrderBookLevel[] {
  return rows
    .map((row) => {
      if (!Array.isArray(row)) return undefined;
      const price = numberValue(row[0]);
      const size = numberValue(row[1]);
      if (!isFinitePositive(price) || !isFinitePositive(size)) return undefined;
      return { price, size };
    })
    .filter((level): level is OrderBookLevel => Boolean(level));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

function numberOrUndefined(value: unknown): number | undefined {
  const number = numberValue(value);
  return Number.isFinite(number) ? number : undefined;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function ascPrice(a: OrderBookLevel, b: OrderBookLevel) {
  return a.price - b.price;
}

function descPrice(a: OrderBookLevel, b: OrderBookLevel) {
  return b.price - a.price;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

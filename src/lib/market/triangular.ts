import type { OrderBookLevel } from "./types";

export type TriangularPair = "BTC-USD" | "ETH-USD" | "ETH-BTC";

export type TriangularBook = {
  pair: TriangularPair;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  sequence?: number;
  receivedAt: number;
};

export type TriangularLeg = {
  action: "buy" | "sell";
  pair: TriangularPair;
  inputAsset: "USD" | "BTC" | "ETH";
  outputAsset: "USD" | "BTC" | "ETH";
  inputAmount: number;
  outputAmount: number;
  feeAmount: number;
  vwap: number;
  complete: boolean;
  levelsUsed: number;
};

export type TriangularRoute = {
  id: "usd-btc-eth-usd" | "usd-eth-btc-usd";
  label: string;
  startUsd: number;
  finalUsd: number;
  grossPnlUsd: number;
  netPnlUsd: number;
  netPnlBps: number;
  complete: boolean;
  rejectionReasons: string[];
  legs: TriangularLeg[];
  explanation: string;
};

export type TriangularLab = {
  generatedAt: number;
  venue: "coinbase";
  startUsd: number;
  feeBps: number;
  routes: TriangularRoute[];
  bestRoute?: TriangularRoute;
  books: Record<TriangularPair, { bid: number; ask: number; bidSize: number; askSize: number; sequence?: number }>;
  sources: string[];
  errors: string[];
};

export function parseCoinbaseBook(
  pair: TriangularPair,
  payload: unknown,
  receivedAt = Date.now(),
): TriangularBook | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.bids) || !Array.isArray(payload.asks)) return undefined;
  const bids = parseLevels(payload.bids);
  const asks = parseLevels(payload.asks);
  if (bids.length === 0 || asks.length === 0) return undefined;
  return {
    pair,
    bids,
    asks,
    sequence: Number.isFinite(Number(payload.sequence)) ? Number(payload.sequence) : undefined,
    receivedAt,
  };
}

export function buildTriangularLab(input: {
  btcUsd?: TriangularBook;
  ethUsd?: TriangularBook;
  ethBtc?: TriangularBook;
  startUsd?: number;
  feeBps?: number;
  errors?: string[];
}): TriangularLab {
  const startUsd = input.startUsd ?? 10_000;
  const feeBps = input.feeBps ?? 60;
  const books = [input.btcUsd, input.ethUsd, input.ethBtc].filter(
    (book): book is TriangularBook => Boolean(book),
  );
  const errors = [...(input.errors ?? [])];

  if (!input.btcUsd) errors.push("Coinbase BTC-USD book unavailable");
  if (!input.ethUsd) errors.push("Coinbase ETH-USD book unavailable");
  if (!input.ethBtc) errors.push("Coinbase ETH-BTC book unavailable");

  const routes =
    input.btcUsd && input.ethUsd && input.ethBtc
      ? [
          simulateUsdBtcEthUsd(input.btcUsd, input.ethUsd, input.ethBtc, startUsd, feeBps),
          simulateUsdEthBtcUsd(input.btcUsd, input.ethUsd, input.ethBtc, startUsd, feeBps),
        ]
      : [];
  const bestRoute = routes.sort((a, b) => b.netPnlUsd - a.netPnlUsd)[0];

  return {
    generatedAt: Date.now(),
    venue: "coinbase",
    startUsd,
    feeBps,
    routes,
    bestRoute,
    books: {
      "BTC-USD": summarizeBook(input.btcUsd),
      "ETH-USD": summarizeBook(input.ethUsd),
      "ETH-BTC": summarizeBook(input.ethBtc),
    },
    sources: [
      "https://api.exchange.coinbase.com/products/BTC-USD/book?level=2",
      "https://api.exchange.coinbase.com/products/ETH-USD/book?level=2",
      "https://api.exchange.coinbase.com/products/ETH-BTC/book?level=2",
    ],
    errors,
  };
}

function simulateUsdBtcEthUsd(
  btcUsd: TriangularBook,
  ethUsd: TriangularBook,
  ethBtc: TriangularBook,
  startUsd: number,
  feeBps: number,
): TriangularRoute {
  const buyBtc = buyBaseWithQuote(btcUsd, startUsd, "USD", "BTC", feeBps);
  const buyEth = buyBaseWithQuote(ethBtc, buyBtc.outputAmount, "BTC", "ETH", feeBps);
  const sellEth = sellBaseForQuote(ethUsd, buyEth.outputAmount, "ETH", "USD", feeBps);
  return routeFromLegs({
    id: "usd-btc-eth-usd",
    label: "USD → BTC → ETH → USD",
    startUsd,
    legs: [buyBtc, buyEth, sellEth],
  });
}

function simulateUsdEthBtcUsd(
  btcUsd: TriangularBook,
  ethUsd: TriangularBook,
  ethBtc: TriangularBook,
  startUsd: number,
  feeBps: number,
): TriangularRoute {
  const buyEth = buyBaseWithQuote(ethUsd, startUsd, "USD", "ETH", feeBps);
  const sellEthForBtc = sellBaseForQuote(ethBtc, buyEth.outputAmount, "ETH", "BTC", feeBps);
  const sellBtc = sellBaseForQuote(btcUsd, sellEthForBtc.outputAmount, "BTC", "USD", feeBps);
  return routeFromLegs({
    id: "usd-eth-btc-usd",
    label: "USD → ETH → BTC → USD",
    startUsd,
    legs: [buyEth, sellEthForBtc, sellBtc],
  });
}

function buyBaseWithQuote(
  book: TriangularBook,
  quoteAmount: number,
  inputAsset: TriangularLeg["inputAsset"],
  outputAsset: TriangularLeg["outputAsset"],
  feeBps: number,
): TriangularLeg {
  let remainingQuote = Math.max(0, quoteAmount);
  let spentQuote = 0;
  let grossBase = 0;
  let levelsUsed = 0;
  for (const ask of book.asks) {
    if (remainingQuote <= 1e-12) break;
    const quoteAtLevel = ask.price * ask.size;
    const quoteToSpend = Math.min(remainingQuote, quoteAtLevel);
    grossBase += quoteToSpend / ask.price;
    spentQuote += quoteToSpend;
    remainingQuote -= quoteToSpend;
    levelsUsed += 1;
  }
  const feeAmount = grossBase * (feeBps / 10_000);
  const outputAmount = grossBase - feeAmount;
  return {
    action: "buy",
    pair: book.pair,
    inputAsset,
    outputAsset,
    inputAmount: spentQuote,
    outputAmount,
    feeAmount,
    vwap: grossBase > 0 ? spentQuote / grossBase : 0,
    complete: remainingQuote <= 1e-8,
    levelsUsed,
  };
}

function sellBaseForQuote(
  book: TriangularBook,
  baseAmount: number,
  inputAsset: TriangularLeg["inputAsset"],
  outputAsset: TriangularLeg["outputAsset"],
  feeBps: number,
): TriangularLeg {
  let remainingBase = Math.max(0, baseAmount);
  let soldBase = 0;
  let grossQuote = 0;
  let levelsUsed = 0;
  for (const bid of book.bids) {
    if (remainingBase <= 1e-12) break;
    const baseToSell = Math.min(remainingBase, bid.size);
    grossQuote += baseToSell * bid.price;
    soldBase += baseToSell;
    remainingBase -= baseToSell;
    levelsUsed += 1;
  }
  const feeAmount = grossQuote * (feeBps / 10_000);
  const outputAmount = grossQuote - feeAmount;
  return {
    action: "sell",
    pair: book.pair,
    inputAsset,
    outputAsset,
    inputAmount: soldBase,
    outputAmount,
    feeAmount,
    vwap: soldBase > 0 ? grossQuote / soldBase : 0,
    complete: remainingBase <= 1e-8,
    levelsUsed,
  };
}

function routeFromLegs(input: {
  id: TriangularRoute["id"];
  label: string;
  startUsd: number;
  legs: TriangularLeg[];
}): TriangularRoute {
  const finalUsd = input.legs[input.legs.length - 1]?.outputAmount ?? 0;
  const grossPnlUsd = finalUsd - input.startUsd;
  const complete = input.legs.every((leg) => leg.complete && leg.outputAmount > 0);
  const rejectionReasons = [];
  if (!complete) rejectionReasons.push("Insufficient triangular depth");
  if (grossPnlUsd <= 0) rejectionReasons.push("Negative net triangular expectancy");
  return {
    id: input.id,
    label: input.label,
    startUsd: input.startUsd,
    finalUsd,
    grossPnlUsd,
    netPnlUsd: grossPnlUsd,
    netPnlBps: input.startUsd > 0 ? (grossPnlUsd / input.startUsd) * 10_000 : 0,
    complete,
    rejectionReasons,
    legs: input.legs,
    explanation: `${input.label}: start ${input.startUsd.toFixed(2)} USD, finish ${finalUsd.toFixed(2)} USD after three taker-fee-adjusted L2 walks.`,
  };
}

function parseLevels(rows: unknown[]): OrderBookLevel[] {
  return rows
    .map((row) => {
      if (!Array.isArray(row)) return undefined;
      const price = Number(row[0]);
      const size = Number(row[1]);
      if (!Number.isFinite(price) || !Number.isFinite(size) || price <= 0 || size <= 0) return undefined;
      return { price, size };
    })
    .filter((level): level is OrderBookLevel => Boolean(level));
}

function summarizeBook(book?: TriangularBook) {
  return {
    bid: book?.bids[0]?.price ?? 0,
    ask: book?.asks[0]?.price ?? 0,
    bidSize: book?.bids[0]?.size ?? 0,
    askSize: book?.asks[0]?.size ?? 0,
    sequence: book?.sequence,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

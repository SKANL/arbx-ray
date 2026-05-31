import { defaultWallets } from "./defaults";
import { evaluateOpportunity } from "./execution";
import type { EngineConfig, OpportunityDecision, OrderBookSnapshot, WalletState } from "./types";

export type EngineThroughputLab = {
  generatedAt: number;
  usedFixture: boolean;
  venues: number;
  cycles: number;
  directedComparisons: number;
  totalEvaluations: number;
  elapsedMs: number;
  p50CycleMs: number;
  p95CycleMs: number;
  maxCycleMs: number;
  estimatedDecisionsPerSecond: number;
  acceptedRoutes: number;
  rejectedRoutes: number;
  bestNetProfitUsd: number;
  sla: {
    latencyBudgetMs: number;
    headroomMs: number;
    utilizationPct: number;
    status: "pass" | "watch" | "fail";
  };
  notes: string[];
};

export function buildEngineThroughputLab(input: {
  books: OrderBookSnapshot[];
  wallets: WalletState;
  config: EngineConfig;
  cycles?: number;
  observedAt?: number;
}): EngineThroughputLab {
  const generatedAt = input.observedAt ?? Date.now();
  const books = input.books.length >= 2 ? input.books : fixtureBooks(generatedAt);
  const wallets = Object.keys(input.wallets).length > 0 ? input.wallets : defaultWallets;
  const cycles = Math.max(1, Math.floor(input.cycles ?? 80));
  const pairs = directedSameLanePairs(books);
  const cycleDurations: number[] = [];
  const decisions: OpportunityDecision[] = [];
  const startedAt = nowMs();

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const cycleStart = nowMs();
    for (const [buyBook, sellBook] of pairs) {
      decisions.push(evaluateOpportunity(buyBook, sellBook, wallets, input.config, generatedAt + cycle));
    }
    cycleDurations.push(Math.max(0, nowMs() - cycleStart));
  }

  const elapsedMs = Math.max(0.001, nowMs() - startedAt);
  const sortedDurations = [...cycleDurations].sort((a, b) => a - b);
  const p50CycleMs = percentile(sortedDurations, 0.5);
  const p95CycleMs = percentile(sortedDurations, 0.95);
  const maxCycleMs = sortedDurations[sortedDurations.length - 1] ?? 0;
  const totalEvaluations = decisions.length;
  const estimatedDecisionsPerSecond = (totalEvaluations / elapsedMs) * 1_000;
  const bestNetProfitUsd = decisions.reduce(
    (best, decision) => Math.max(best, decision.netProfitUsd),
    Number.NEGATIVE_INFINITY,
  );
  const utilizationPct = input.config.maxLatencyMs > 0 ? (p95CycleMs / input.config.maxLatencyMs) * 100 : 100;

  return {
    generatedAt,
    usedFixture: input.books.length < 2,
    venues: books.length,
    cycles,
    directedComparisons: pairs.length,
    totalEvaluations,
    elapsedMs,
    p50CycleMs,
    p95CycleMs,
    maxCycleMs,
    estimatedDecisionsPerSecond,
    acceptedRoutes: decisions.filter((decision) => decision.status === "accepted").length,
    rejectedRoutes: decisions.filter((decision) => decision.status === "rejected").length,
    bestNetProfitUsd: Number.isFinite(bestNetProfitUsd) ? bestNetProfitUsd : 0,
    sla: {
      latencyBudgetMs: input.config.maxLatencyMs,
      headroomMs: input.config.maxLatencyMs - p95CycleMs,
      utilizationPct,
      status: utilizationPct <= 35 ? "pass" : utilizationPct <= 75 ? "watch" : "fail",
    },
    notes: [
      `${pairs.length} same-lane directed route comparisons per cycle.`,
      `${cycles} benchmark cycles executed in the current JavaScript runtime.`,
      input.books.length < 2
        ? "Using deterministic fixture books because fewer than two live books are available."
        : "Using current normalized books from the engine state.",
    ],
  };
}

function directedSameLanePairs(books: OrderBookSnapshot[]): Array<[OrderBookSnapshot, OrderBookSnapshot]> {
  const pairs: Array<[OrderBookSnapshot, OrderBookSnapshot]> = [];
  for (const buyBook of books) {
    for (const sellBook of books) {
      if (buyBook.exchangeId === sellBook.exchangeId) continue;
      if (buyBook.quoteAsset !== sellBook.quoteAsset) continue;
      pairs.push([buyBook, sellBook]);
    }
  }
  return pairs;
}

function fixtureBooks(receivedAt: number): OrderBookSnapshot[] {
  return [
    makeFixtureBook("kraken", "USD", 70_140, 70_080, receivedAt),
    makeFixtureBook("coinbase", "USD", 70_260, 70_180, receivedAt),
    makeFixtureBook("gemini", "USD", 70_210, 70_160, receivedAt),
    makeFixtureBook("binance", "USDT", 70_120, 70_070, receivedAt),
    makeFixtureBook("bybit", "USDT", 70_180, 70_110, receivedAt),
    makeFixtureBook("gate", "USDT", 70_170, 70_115, receivedAt),
  ];
}

function makeFixtureBook(
  exchangeId: string,
  quoteAsset: "USD" | "USDT",
  bid: number,
  ask: number,
  receivedAt: number,
): OrderBookSnapshot {
  return {
    exchangeId,
    symbol: quoteAsset === "USD" ? "BTC-USD" : "BTC-USDT",
    baseAsset: "BTC",
    quoteAsset,
    bids: [
      { price: bid, size: 0.7 },
      { price: bid - 18, size: 0.9 },
      { price: bid - 42, size: 1.4 },
    ],
    asks: [
      { price: ask, size: 0.7 },
      { price: ask + 18, size: 0.9 },
      { price: ask + 42, size: 1.4 },
    ],
    receivedAt,
  };
}

function percentile(sortedValues: number[], percentileValue: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1),
  );
  return sortedValues[index] ?? 0;
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

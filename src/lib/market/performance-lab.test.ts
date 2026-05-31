import { describe, expect, it } from "vitest";
import { buildEngineThroughputLab } from "./performance-lab";
import { defaultEngineConfig, defaultWallets } from "./defaults";
import type { OrderBookSnapshot } from "./types";

const now = 1_780_000_000_000;

function book(exchangeId: string, quoteAsset: "USD" | "USDT", bid: number, ask: number): OrderBookSnapshot {
  return {
    exchangeId,
    symbol: quoteAsset === "USD" ? "BTC-USD" : "BTC-USDT",
    baseAsset: "BTC",
    quoteAsset,
    bids: [
      { price: bid, size: 1.2 },
      { price: bid - 20, size: 1 },
    ],
    asks: [
      { price: ask, size: 1.2 },
      { price: ask + 20, size: 1 },
    ],
    receivedAt: now,
  };
}

describe("buildEngineThroughputLab", () => {
  it("counts same-lane directed comparisons and benchmark cycles", () => {
    const lab = buildEngineThroughputLab({
      books: [
        book("kraken", "USD", 70_100, 70_000),
        book("coinbase", "USD", 70_250, 70_150),
        book("binance", "USDT", 70_120, 70_050),
      ],
      wallets: defaultWallets,
      config: defaultEngineConfig,
      cycles: 40,
      observedAt: now,
    });

    expect(lab.venues).toBe(3);
    expect(lab.directedComparisons).toBe(2);
    expect(lab.totalEvaluations).toBe(80);
    expect(lab.cycles).toBe(40);
    expect(lab.estimatedDecisionsPerSecond).toBeGreaterThan(0);
    expect(lab.p95CycleMs).toBeGreaterThanOrEqual(lab.p50CycleMs);
  });

  it("falls back to deterministic fixture books when live books are unavailable", () => {
    const lab = buildEngineThroughputLab({
      books: [],
      wallets: {},
      config: defaultEngineConfig,
      cycles: 10,
      observedAt: now,
    });

    expect(lab.usedFixture).toBe(true);
    expect(lab.venues).toBeGreaterThan(1);
    expect(lab.directedComparisons).toBeGreaterThan(0);
    expect(lab.sla.status).toMatch(/pass|watch|fail/);
  });

  it("classifies SLA status from p95 cycle time and latency budget", () => {
    const lab = buildEngineThroughputLab({
      books: [book("kraken", "USD", 70_100, 70_000), book("coinbase", "USD", 70_250, 70_150)],
      wallets: defaultWallets,
      config: { ...defaultEngineConfig, maxLatencyMs: 1 },
      cycles: 20,
      observedAt: now,
    });

    expect(lab.sla.latencyBudgetMs).toBe(1);
    expect(lab.sla.headroomMs).toBeLessThanOrEqual(1);
  });
});

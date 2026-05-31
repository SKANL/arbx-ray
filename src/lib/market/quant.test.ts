import { describe, expect, it } from "vitest";
import {
  buildImpactCurve,
  estimatePositivePnlProbability,
  estimateRealizedVolBpsPerSecond,
  getBookMicrostructure,
} from "./quant";
import type { EngineConfig, OrderBookSnapshot } from "./types";

const config: EngineConfig = {
  maxTradeBtc: 1,
  minNetProfitUsd: 1,
  staleBookMs: 2_000,
  maxLatencyMs: 800,
  latencyVolatilityBpsPerSecond: 8,
  withdrawalFeeBtc: 0.00008,
  usdtUsdHaircutBps: 12,
  feesBps: { kraken: 26, coinbase: 60 },
};

function book(exchangeId: string, bids: [number, number][], asks: [number, number][]): OrderBookSnapshot {
  return {
    exchangeId,
    symbol: "BTC/USD",
    baseAsset: "BTC",
    quoteAsset: "USD",
    bids: bids.map(([price, size]) => ({ price, size })),
    asks: asks.map(([price, size]) => ({ price, size })),
    receivedAt: 1_000,
  };
}

describe("getBookMicrostructure", () => {
  it("computes microprice and top-of-book imbalance", () => {
    const snapshot = book("kraken", [[100, 3]], [[102, 1]]);

    const metrics = getBookMicrostructure(snapshot);

    expect(metrics.midPrice).toBe(101);
    expect(metrics.microprice).toBeCloseTo(101.5, 5);
    expect(metrics.imbalance).toBe(0.5);
  });

  it("computes multi-depth pressure and liquidity cliff", () => {
    const snapshot = book("kraken", [[100, 2.5], [99, 3], [98, 1]], [[102, 2], [103, 0.8], [104, 0.2]]);

    const metrics = getBookMicrostructure(snapshot);

    expect(metrics.depthImbalance).toBeGreaterThan(metrics.imbalance);
    expect(metrics.queuePressureBtc).toBeCloseTo(3.5, 5);
    expect(metrics.liquidityCliffRatio).toBeGreaterThan(2);
    expect(metrics.micropriceDriftBps).toBeGreaterThan(0);
  });
});

describe("estimatePositivePnlProbability", () => {
  it("converts net edge, notional, volatility, and latency into a bounded probability", () => {
    const probability = estimatePositivePnlProbability({
      netProfitUsd: 15,
      notionalUsd: 50_000,
      latencyMs: 400,
      realizedVolBpsPerSecond: 4,
    });

    expect(probability).toBeGreaterThan(0.6);
    expect(probability).toBeLessThan(1);
  });
});

describe("estimateRealizedVolBpsPerSecond", () => {
  it("estimates realized volatility from one-minute candle closes", () => {
    const vol = estimateRealizedVolBpsPerSecond([100, 100.2, 99.9, 100.4, 100.1], 60);

    expect(vol).toBeGreaterThan(0);
    expect(vol).toBeLessThan(10);
  });
});

describe("buildImpactCurve", () => {
  it("shows net P&L decay as requested size walks deeper liquidity", () => {
    const buy = book("kraken", [[100, 2]], [
      [100, 0.2],
      [101, 0.5],
      [102, 1],
    ]);
    const sell = book("coinbase", [
      [104, 0.2],
      [103, 0.5],
      [102.5, 1],
    ], [[105, 1]]);

    const curve = buildImpactCurve(buy, sell, config, [0.1, 0.5, 1], 1_100);

    expect(curve).toHaveLength(3);
    expect(curve[0]?.sizeBtc).toBe(0.1);
    const firstNetPerBtc = (curve[0]?.netProfitUsd ?? 0) / (curve[0]?.sizeBtc ?? 1);
    const finalNetPerBtc = (curve[2]?.netProfitUsd ?? 0) / (curve[2]?.sizeBtc ?? 1);
    expect(firstNetPerBtc).toBeGreaterThan(finalNetPerBtc);
  });
});

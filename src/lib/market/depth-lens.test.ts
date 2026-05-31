import { describe, expect, it } from "vitest";
import { buildExecutionDepthLens } from "./depth-lens";
import type { OpportunityDecision } from "./types";

const decision: OpportunityDecision = {
  id: "depth",
  status: "accepted",
  buyExchange: "kraken",
  sellExchange: "coinbase",
  quoteAsset: "USD",
  observedAt: 1,
  tradeSizeBtc: 0.75,
  grossProfitUsd: 300,
  netProfitUsd: 100,
  buyFill: {
    filledBtc: 0.75,
    notional: 52_510,
    vwap: 70_013.333333,
    complete: true,
    levelsUsed: [
      { price: 70_000, requestedBtc: 0.75, filledBtc: 0.25, notional: 17_500 },
      { price: 70_020, requestedBtc: 0.5, filledBtc: 0.5, notional: 35_010 },
    ],
  },
  sellFill: {
    filledBtc: 0.75,
    notional: 52_800,
    vwap: 70_400,
    complete: true,
    levelsUsed: [
      { price: 70_500, requestedBtc: 0.75, filledBtc: 0.25, notional: 17_625 },
      { price: 70_350, requestedBtc: 0.5, filledBtc: 0.5, notional: 35_175 },
    ],
  },
  impactCurve: [],
  microstructure: {
    buy: { midPrice: 70_000, spreadUsd: 1, spreadBps: 0.14, imbalance: 0, microprice: 70_000, pressure: "neutral" },
    sell: { midPrice: 70_400, spreadUsd: 1, spreadBps: 0.14, imbalance: 0, microprice: 70_400, pressure: "neutral" },
  },
  rejectionReasons: [],
  risk: {
    score: 90,
    latencyPenaltyUsd: 0,
    feeCostUsd: 100,
    withdrawalCostUsd: 10,
    grossProfitUsd: 300,
    positivePnlProbability: 0.9,
    reasons: [],
  },
  explanation: "depth",
};

describe("buildExecutionDepthLens", () => {
  it("derives cumulative VWAP and slippage for both execution sides", () => {
    const lens = buildExecutionDepthLens(decision);

    expect(lens.buy.levels).toHaveLength(2);
    expect(lens.buy.levels[1]?.cumulativeBtc).toBe(0.75);
    expect(lens.buy.slippageBps).toBeGreaterThan(0);
    expect(lens.sell.slippageBps).toBeGreaterThan(0);
    expect(lens.netVwapEdgeBps).toBeGreaterThan(0);
  });
});

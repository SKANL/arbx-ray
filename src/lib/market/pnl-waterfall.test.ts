import { describe, expect, it } from "vitest";
import { buildPnlWaterfall } from "./pnl-waterfall";
import type { OpportunityDecision } from "./types";

const decision: OpportunityDecision = {
  id: "waterfall",
  status: "accepted",
  buyExchange: "kraken",
  sellExchange: "coinbase",
  quoteAsset: "USD",
  observedAt: 1,
  tradeSizeBtc: 1,
  grossProfitUsd: 500,
  netProfitUsd: 225,
  buyFill: { filledBtc: 1, notional: 70_000, vwap: 70_000, complete: true, levelsUsed: [] },
  sellFill: { filledBtc: 1, notional: 70_500, vwap: 70_500, complete: true, levelsUsed: [] },
  impactCurve: [],
  microstructure: {
    buy: { midPrice: 70_000, spreadUsd: 1, spreadBps: 0.14, imbalance: 0, microprice: 70_000, pressure: "neutral" },
    sell: { midPrice: 70_500, spreadUsd: 1, spreadBps: 0.14, imbalance: 0, microprice: 70_500, pressure: "neutral" },
  },
  rejectionReasons: [],
  risk: {
    score: 90,
    latencyPenaltyUsd: 25,
    feeCostUsd: 180,
    withdrawalCostUsd: 40,
    grossProfitUsd: 500,
    positivePnlProbability: 0.8,
    reasons: [],
  },
  explanation: "net formula",
};

describe("buildPnlWaterfall", () => {
  it("decomposes gross edge into costs and final net P&L", () => {
    const steps = buildPnlWaterfall(decision);

    expect(steps.map((step) => step.id)).toEqual([
      "gross",
      "fees",
      "withdrawal",
      "latency",
      "basis",
      "net",
    ]);
    expect(steps.find((step) => step.id === "basis")?.valueUsd).toBe(-30);
    expect(steps[steps.length - 1]?.runningUsd).toBe(225);
  });
});

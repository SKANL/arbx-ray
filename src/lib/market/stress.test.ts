import { describe, expect, it } from "vitest";
import { buildJudgeScorecard, runStressScenarios, summarizeImpactCurve } from "./stress";
import type { OpportunityDecision } from "./types";

const decision: OpportunityDecision = {
  id: "d1",
  status: "accepted",
  buyExchange: "kraken",
  sellExchange: "coinbase",
  quoteAsset: "USD",
  observedAt: 1,
  tradeSizeBtc: 0.75,
  grossProfitUsd: 650,
  netProfitUsd: 234,
  buyFill: { filledBtc: 0.75, notional: 52_500, vwap: 70_000, complete: true, levelsUsed: [] },
  sellFill: { filledBtc: 0.75, notional: 53_150, vwap: 70_866.67, complete: true, levelsUsed: [] },
  impactCurve: [
    { sizeBtc: 0.1, grossProfitUsd: 80, netProfitUsd: 30, buyVwap: 70_000, sellVwap: 70_800, accepted: true },
    { sizeBtc: 0.5, grossProfitUsd: 350, netProfitUsd: 180, buyVwap: 70_010, sellVwap: 70_720, accepted: true },
    { sizeBtc: 0.75, grossProfitUsd: 650, netProfitUsd: 210, buyVwap: 70_020, sellVwap: 70_710, accepted: true },
  ],
  microstructure: {
    buy: { midPrice: 70_000, spreadUsd: 20, spreadBps: 2.8, imbalance: 0.4, microprice: 70_006, pressure: "bid" },
    sell: { midPrice: 70_900, spreadUsd: 30, spreadBps: 4.2, imbalance: -0.2, microprice: 70_895, pressure: "ask" },
  },
  rejectionReasons: [],
  risk: {
    score: 88,
    latencyPenaltyUsd: 20,
    feeCostUsd: 390,
    withdrawalCostUsd: 6,
    grossProfitUsd: 650,
    positivePnlProbability: 0.91,
    reasons: ["Same quote lane: USD"],
  },
  explanation: "net = gross - costs",
};

describe("runStressScenarios", () => {
  it("penalizes hostile latency, liquidity, fee, and volatility conditions", () => {
    const results = runStressScenarios(decision);

    expect(results).toHaveLength(5);
    expect(results[0]?.stressedNetProfitUsd).toBe(decision.netProfitUsd);
    expect(results[0]?.survives).toBe(true);
    expect(results[0]?.stressedNetProfitUsd).toBeGreaterThan(results[4]?.stressedNetProfitUsd ?? 0);
    expect(results.some((result) => !result.survives)).toBe(true);
  });
});

describe("buildJudgeScorecard", () => {
  it("produces bounded challenge-oriented scores and presentation bullets", () => {
    const scorecard = buildJudgeScorecard({
      decision,
      stressResults: runStressScenarios(decision),
      liveBooks: 5,
      enabledVenues: 6,
      publicSources: 5,
    });

    expect(scorecard.overall).toBeGreaterThan(70);
    expect(scorecard.overall).toBeLessThanOrEqual(100);
    expect(scorecard.bullets).toHaveLength(4);
  });
});

describe("summarizeImpactCurve", () => {
  it("identifies the best simulated size from the impact curve", () => {
    expect(summarizeImpactCurve(decision.impactCurve)).toEqual({
      bestSizeBtc: 0.75,
      bestNetProfitUsd: 210,
      firstNegativeSizeBtc: undefined,
    });
  });
});

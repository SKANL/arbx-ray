import { describe, expect, it } from "vitest";
import { buildEdgeConviction } from "./edge-conviction";
import type { HistoricalReplay } from "./historical";
import type { LiquidityRadar } from "./liquidity-radar";
import type { EngineThroughputLab } from "./performance-lab";
import type { StressResult } from "./stress";
import type { FeedHealth, OpportunityDecision } from "./types";

const decision: OpportunityDecision = {
  id: "d1",
  status: "accepted",
  buyExchange: "kraken",
  sellExchange: "coinbase",
  quoteAsset: "USD",
  observedAt: 1,
  tradeSizeBtc: 0.5,
  grossProfitUsd: 450,
  netProfitUsd: 120,
  buyFill: { filledBtc: 0.5, notional: 35_000, vwap: 70_000, complete: true, levelsUsed: [] },
  sellFill: { filledBtc: 0.5, notional: 35_450, vwap: 70_900, complete: true, levelsUsed: [] },
  impactCurve: [],
  microstructure: {
    buy: { midPrice: 70_010, spreadUsd: 10, spreadBps: 1.4, imbalance: 0.3, microprice: 70_014, pressure: "bid" },
    sell: { midPrice: 70_880, spreadUsd: 12, spreadBps: 1.7, imbalance: -0.2, microprice: 70_877, pressure: "ask" },
  },
  rejectionReasons: [],
  risk: {
    score: 92,
    latencyPenaltyUsd: 12,
    feeCostUsd: 310,
    withdrawalCostUsd: 8,
    grossProfitUsd: 450,
    positivePnlProbability: 0.88,
    reasons: ["Same quote lane: USD"],
  },
  explanation: "net = gross - costs",
};

const stressResults: StressResult[] = [
  { id: "normal", label: "normal", stressedNetProfitUsd: 120, stressedProbability: 0.88, survives: true, explanation: "" },
  { id: "slow", label: "slow", stressedNetProfitUsd: 40, stressedProbability: 0.7, survives: true, explanation: "" },
  { id: "fast", label: "fast", stressedNetProfitUsd: -10, stressedProbability: 0.48, survives: false, explanation: "" },
];

const historicalReplay = {
  statArb: {
    regime: "mean-reverting",
    returnCorrelation: 0.94,
    latestZScore: 1.1,
    halfLifeMinutes: 2,
  },
} as HistoricalReplay;

const liquidityRadar = {
  summary: {
    executableRoutes: 3,
    routeCount: 8,
    bestNetProfitUsd: 85,
  },
} as LiquidityRadar;

const throughput = {
  sla: { status: "pass", utilizationPct: 12 },
  estimatedDecisionsPerSecond: 15_000,
} as EngineThroughputLab;

const health: FeedHealth[] = [
  { exchangeId: "kraken", status: "live", latencyMs: 30 },
  { exchangeId: "coinbase", status: "live", latencyMs: 35 },
];

describe("buildEdgeConviction", () => {
  it("raises posterior conviction when live, historical, liquidity, and speed evidence agree", () => {
    const conviction = buildEdgeConviction({
      decision,
      stressResults,
      historicalReplay,
      liquidityRadar,
      throughput,
      health,
    });

    expect(conviction.posteriorProbability).toBeGreaterThan(0.75);
    expect(conviction.recommendation).toBe("simulate-execute");
    expect(conviction.factors.some((factor) => factor.id === "historical-regime" && factor.weight > 0)).toBe(true);
    expect(conviction.confidenceInterval.low).toBeLessThan(conviction.posteriorProbability);
    expect(conviction.confidenceInterval.high).toBeGreaterThan(conviction.posteriorProbability);
  });

  it("rejects when the latest decision is rejected even if auxiliary evidence exists", () => {
    const conviction = buildEdgeConviction({
      decision: { ...decision, status: "rejected", rejectionReasons: ["Negative net expectancy"], netProfitUsd: -20 },
      stressResults,
      historicalReplay,
      liquidityRadar,
      throughput,
      health,
    });

    expect(conviction.posteriorProbability).toBeLessThan(0.5);
    expect(conviction.recommendation).toBe("reject");
  });

  it("falls back to low-confidence wait state with no decision", () => {
    const conviction = buildEdgeConviction({
      stressResults: [],
      health: [],
    });

    expect(conviction.recommendation).toBe("wait-for-evidence");
    expect(conviction.factors.some((factor) => factor.id === "decision-state")).toBe(true);
    expect(conviction.evidenceScore).toBeLessThan(50);
  });
});

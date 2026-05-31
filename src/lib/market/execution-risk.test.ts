import { describe, expect, it } from "vitest";
import { buildLatencyRiskCone, deriveKellySizing, runMonteCarloExecution } from "./execution-risk";
import type { OpportunityDecision } from "./types";

const decision: OpportunityDecision = {
  id: "d1",
  status: "accepted",
  buyExchange: "kraken",
  sellExchange: "coinbase",
  quoteAsset: "USD",
  observedAt: 1,
  tradeSizeBtc: 0.2,
  grossProfitUsd: 80,
  netProfitUsd: 35,
  buyFill: {
    filledBtc: 0.2,
    notional: 20_000,
    vwap: 100_000,
    complete: true,
    levelsUsed: [],
  },
  sellFill: {
    filledBtc: 0.2,
    notional: 20_080,
    vwap: 100_400,
    complete: true,
    levelsUsed: [],
  },
  impactCurve: [],
  microstructure: {
    buy: { midPrice: 100_000, spreadUsd: 10, spreadBps: 1, imbalance: 0.2, microprice: 100_003, pressure: "bid" },
    sell: { midPrice: 100_400, spreadUsd: 10, spreadBps: 1, imbalance: -0.1, microprice: 100_398, pressure: "neutral" },
  },
  rejectionReasons: [],
  risk: {
    score: 90,
    latencyPenaltyUsd: 5,
    feeCostUsd: 30,
    withdrawalCostUsd: 10,
    grossProfitUsd: 80,
    positivePnlProbability: 0.8,
    reasons: [],
  },
  explanation: "net formula",
};

describe("buildLatencyRiskCone", () => {
  it("derives a latency-sensitive P&L probability cone", () => {
    const cone = buildLatencyRiskCone(decision, 4);

    expect(cone.points).toHaveLength(6);
    expect(cone.points[0]?.latencyMs).toBe(50);
    expect(cone.points[0]?.expectedPnlUsd).toBeGreaterThan(cone.points[5]?.expectedPnlUsd ?? 0);
    expect(cone.points[0]?.p05PnlUsd).toBeLessThan(cone.points[0]?.p50PnlUsd ?? 0);
    expect(cone.points[0]?.positiveProbability).toBeGreaterThan(0.5);
  });
});

describe("runMonteCarloExecution", () => {
  it("produces a deterministic distribution with tail risk metrics", () => {
    const simulation = runMonteCarloExecution({
      decision,
      realizedVolBpsPerSecond: 4,
      trials: 1_000,
      horizonMs: 1_000,
      seed: 42,
      bins: 12,
    });
    const repeated = runMonteCarloExecution({
      decision,
      realizedVolBpsPerSecond: 4,
      trials: 1_000,
      horizonMs: 1_000,
      seed: 42,
      bins: 12,
    });

    expect(simulation.histogram).toHaveLength(12);
    expect(simulation.p05PnlUsd).toBeLessThan(simulation.medianPnlUsd);
    expect(simulation.p95PnlUsd).toBeGreaterThan(simulation.medianPnlUsd);
    expect(simulation.lossProbability).toBeGreaterThanOrEqual(0);
    expect(simulation.lossProbability).toBeLessThanOrEqual(1);
    expect(simulation.meanPnlUsd).toBeCloseTo(repeated.meanPnlUsd, 8);
  });
});

describe("deriveKellySizing", () => {
  it("caps a positive edge with fractional Kelly sizing", () => {
    const simulation = runMonteCarloExecution({
      decision,
      realizedVolBpsPerSecond: 4,
      trials: 1_000,
      horizonMs: 1_000,
      seed: 42,
    });

    const sizing = deriveKellySizing({
      decision,
      simulation,
      bankrollUsd: 100_000,
      fraction: 0.25,
      maxFraction: 0.08,
    });

    expect(sizing.meanReturnBps).toBeGreaterThan(0);
    expect(sizing.recommendedNotionalUsd).toBeGreaterThan(0);
    expect(sizing.cappedFraction).toBeLessThanOrEqual(0.08);
    expect(["cap", "increase"]).toContain(sizing.decision);
  });

  it("skips allocation when the decision is rejected", () => {
    const rejected = { ...decision, status: "rejected" as const, rejectionReasons: ["Negative net expectancy"] };
    const simulation = runMonteCarloExecution({
      decision: rejected,
      realizedVolBpsPerSecond: 4,
      trials: 1_000,
      horizonMs: 1_000,
      seed: 42,
    });

    const sizing = deriveKellySizing({ decision: rejected, simulation });

    expect(sizing.decision).toBe("skip");
    expect(sizing.recommendedNotionalUsd).toBe(0);
  });
});

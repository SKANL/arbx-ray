import { describe, expect, it } from "vitest";
import { buildOptimalStoppingFrontier } from "./optimal-stopping-frontier";
import type { ConformalExecutionGuard } from "./conformal-execution-guard";
import type { LatencyAlphaRace } from "./latency-alpha-race";
import type { OpportunityHeatmap } from "./opportunity-heatmap";
import type { OpportunityDecision } from "./types";

describe("buildOptimalStoppingFrontier", () => {
  it("waits when no executable decision exists", () => {
    const frontier = buildOptimalStoppingFrontier({});

    expect(frontier.summary.policy).toBe("wait-for-edge");
    expect(frontier.summary.bestHorizonMs).toBe(0);
    expect(frontier.frontier).toHaveLength(0);
    expect(frontier.reasons).toContain("waiting for an accepted simulated route");
  });

  it("executes immediately when edge half-life is short and waiting destroys expected value", () => {
    const frontier = buildOptimalStoppingFrontier({
      decision: decision({ netProfitUsd: 42 }),
      latencyAlphaRace: race({ halfLifeMs: 180, survival: 0.78 }),
      conformalGuard: conformal({ quantileResidualUsd: 6, lowerBoundUsd: 36 }),
      realizedVolBpsPerSecond: 4,
    });

    expect(frontier.summary.policy).toBe("execute-now");
    expect(frontier.summary.bestHorizonMs).toBe(0);
    expect(frontier.frontier[0]?.expectedValueUsd).toBeGreaterThan(frontier.frontier[2]?.expectedValueUsd ?? 0);
    expect(frontier.equation).toContain("EV(wait_t)");
  });

  it("waits briefly when slow edge decay and historical clustering create positive option value", () => {
    const frontier = buildOptimalStoppingFrontier({
      decision: decision({ netProfitUsd: 18 }),
      latencyAlphaRace: race({ halfLifeMs: 8_000, survival: 0.92 }),
      conformalGuard: conformal({ quantileResidualUsd: 3, lowerBoundUsd: 15 }),
      opportunityHeatmap: heatmap({ concentrationScore: 88 }),
      realizedVolBpsPerSecond: 1.2,
    });

    expect(frontier.summary.policy).toBe("wait-short");
    expect(frontier.summary.bestHorizonMs).toBeGreaterThan(0);
    expect(frontier.summary.bestHorizonMs).toBeLessThanOrEqual(1_000);
    expect(frontier.summary.optionValueUsd).toBeGreaterThan(0);
  });

  it("caps size when all horizons are fragile after conformal downside", () => {
    const frontier = buildOptimalStoppingFrontier({
      decision: decision({ netProfitUsd: 12, tradeSizeBtc: 0.6 }),
      latencyAlphaRace: race({ halfLifeMs: 900, survival: 0.45 }),
      conformalGuard: conformal({ quantileResidualUsd: 24, lowerBoundUsd: -12, recommendedSizeBtc: 0.2 }),
      realizedVolBpsPerSecond: 6,
    });

    expect(frontier.summary.policy).toBe("cap-size");
    expect(frontier.summary.recommendedSizeBtc).toBe(0.2);
    expect(frontier.summary.bestExpectedValueUsd).toBeLessThan(0);
    expect(frontier.reasons.join(" ")).toContain("cap");
  });
});

function decision(input: { netProfitUsd: number; tradeSizeBtc?: number }): OpportunityDecision {
  const tradeSizeBtc = input.tradeSizeBtc ?? 0.25;
  return {
    id: "decision",
    status: "accepted",
    buyExchange: "kraken",
    sellExchange: "coinbase",
    quoteAsset: "USD",
    observedAt: 1,
    tradeSizeBtc,
    grossProfitUsd: input.netProfitUsd + 10,
    netProfitUsd: input.netProfitUsd,
    buyFill: { filledBtc: tradeSizeBtc, notional: 70_000 * tradeSizeBtc, vwap: 70_000, complete: true, levelsUsed: [{ price: 70_000, requestedBtc: tradeSizeBtc, filledBtc: tradeSizeBtc, notional: 70_000 * tradeSizeBtc }] },
    sellFill: { filledBtc: tradeSizeBtc, notional: 70_120 * tradeSizeBtc, vwap: 70_120, complete: true, levelsUsed: [{ price: 70_120, requestedBtc: tradeSizeBtc, filledBtc: tradeSizeBtc, notional: 70_120 * tradeSizeBtc }] },
    rejectionReasons: [],
    risk: {
      score: 80,
      latencyPenaltyUsd: 1,
      feeCostUsd: 8,
      withdrawalCostUsd: 1,
      grossProfitUsd: input.netProfitUsd + 10,
      positivePnlProbability: 0.72,
      reasons: ["fixture"],
    },
    impactCurve: [],
    microstructure: {
      buy: { midPrice: 70_000, spreadUsd: 2, spreadBps: 0.3, imbalance: 0, microprice: 70_000, pressure: "neutral" },
      sell: { midPrice: 70_120, spreadUsd: 2, spreadBps: 0.3, imbalance: 0, microprice: 70_120, pressure: "neutral" },
    },
    explanation: "fixture",
  };
}

function race(input: { halfLifeMs: number; survival: number }): LatencyAlphaRace {
  return {
    generatedAt: 1,
    route: "KRAKEN -> COINBASE",
    quoteAsset: "USD",
    curve: [],
    factors: [],
    reasons: [],
    summary: {
      policy: "cross-now",
      ourRaceLatencyMs: 90,
      competitorArrivalMs: 70,
      edgeHalfLifeMs: input.halfLifeMs,
      aggressiveFlowBtcPerSecond: 0.01,
      survivalProbability: input.survival,
      expectedCaptureUsd: 10,
      tailRiskUsd: 2,
      raceScore: 78,
    },
    equation: "fixture",
  };
}

function conformal(input: {
  quantileResidualUsd: number;
  lowerBoundUsd: number;
  recommendedSizeBtc?: number;
}): ConformalExecutionGuard {
  return {
    summary: {
      policy: input.lowerBoundUsd > 0 ? "execute" : "cap-size",
      targetCoverage: 0.9,
      sampleCount: 20,
      quantileResidualUsd: input.quantileResidualUsd,
      expectedNetUsd: 20,
      lowerBoundUsd: input.lowerBoundUsd,
      recommendedSizeBtc: input.recommendedSizeBtc ?? 0.25,
      coverageScore: 80,
      tailHitRate: 0.1,
    },
    calibration: [],
    equation: "fixture",
    reasons: [],
    sources: [],
  };
}

function heatmap(input: { concentrationScore: number }): OpportunityHeatmap {
  return {
    generatedAt: 1,
    cells: [],
    summary: {
      policy: "pattern-detected",
      opportunityCount: 8,
      hotHourUtc: 14,
      hotTier: "strong",
      concentrationScore: input.concentrationScore,
      bestCellPnlUsd: 120,
      bestCellWinRate: 0.9,
    },
    equation: "fixture",
  };
}

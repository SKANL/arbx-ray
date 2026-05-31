import { describe, expect, it } from "vitest";
import { buildSequentialExecutionTest } from "./sequential-execution-test";
import type { CausalExecutionGraph } from "./causal-execution-graph";
import type { EdgeConviction } from "./edge-conviction";
import type { HawkesFlowShockOracle } from "./hawkes-flow";
import type { LatencyAlphaRace } from "./latency-alpha-race";
import type { LiquidityMirageDetector } from "./liquidity-mirage";
import type { RiskGovernor } from "./risk-governor";
import type { OpportunityDecision } from "./types";
import type { WalkForwardRobustness } from "./walk-forward";

describe("buildSequentialExecutionTest", () => {
  it("accepts execution when independent evidence crosses the upper SPRT boundary", () => {
    const test = buildSequentialExecutionTest({
      decision: decision("accepted", 148, 0.86),
      edgeConviction: conviction("simulate-execute", 0.88),
      latencyAlphaRace: latency("cross-now", 0.82, 112, 82),
      hawkesFlowShock: hawkes("allow", 0.18, 0.2),
      liquidityMirage: mirage("allow", 14, 91),
      riskGovernor: governor("normal", 96),
      walkForwardRobustness: walkForward("deploy", 0.86),
      causalExecutionGraph: causal("execute-simulated", 87, 0, 0),
      observedAt: 1_780_000_000_000,
    });

    expect(test.summary.decision).toBe("accept-execute");
    expect(test.summary.finalLogLikelihood).toBeGreaterThan(test.upperBoundary);
    expect(test.summary.confidencePct).toBeGreaterThan(85);
    expect(test.steps.at(-1)?.cumulativeLogLikelihood).toBe(test.summary.finalLogLikelihood);
    expect(test.steps.some((step) => step.direction === "supports-execution")).toBe(true);
    expect(test.equation).toContain("upper_boundary");
  });

  it("rejects execution when hard blockers cross the lower SPRT boundary", () => {
    const test = buildSequentialExecutionTest({
      decision: decision("accepted", 12, 0.52),
      edgeConviction: conviction("reject", 0.31),
      latencyAlphaRace: latency("reject-race-lost", 0.18, -34, 18),
      hawkesFlowShock: hawkes("halt-shock", 0.92, 0.94),
      liquidityMirage: mirage("halt-mirage", 88, 22),
      riskGovernor: governor("halt", 8),
      walkForwardRobustness: walkForward("reject-overfit", 0.18),
      causalExecutionGraph: causal("halt-simulated", 18, 74, 5),
      observedAt: 1_780_000_000_000,
    });

    expect(test.summary.decision).toBe("reject-execution");
    expect(test.summary.finalLogLikelihood).toBeLessThan(test.lowerBoundary);
    expect(test.summary.strongestRejection).toBeDefined();
    expect(test.reasons.join(" ")).toContain("hard blocker");
    expect(test.reasons.join(" ")).toContain("SPRT lower boundary");
  });

  it("accepts capped sizing when evidence is positive but execution constraints require a cap", () => {
    const test = buildSequentialExecutionTest({
      decision: decision("accepted", 74, 0.76),
      edgeConviction: conviction("cap-size", 0.76),
      latencyAlphaRace: latency("cap-size", 0.59, 38, 58),
      hawkesFlowShock: hawkes("cap-size", 0.45, 0.48),
      liquidityMirage: mirage("cap-size", 52, 64),
      riskGovernor: governor("caution", 72),
      walkForwardRobustness: walkForward("cap-size", 0.58),
      causalExecutionGraph: causal("cap-size", 64, 23, 0),
      observedAt: 1_780_000_000_000,
    });

    expect(test.summary.decision).toBe("accept-cap-size");
    expect(test.summary.finalLogLikelihood).toBeGreaterThan(0);
    expect(test.summary.finalLogLikelihood).toBeLessThan(test.upperBoundary);
    expect(test.reasons.join(" ")).toContain("capped");
  });
});

function decision(status: OpportunityDecision["status"], netProfitUsd: number, positivePnlProbability: number): OpportunityDecision {
  return {
    id: `decision-${status}-${netProfitUsd}`,
    status,
    buyExchange: "coinbase",
    sellExchange: "kraken",
    quoteAsset: "USD",
    observedAt: 1_780_000_000_000,
    tradeSizeBtc: 0.35,
    grossProfitUsd: netProfitUsd + 42,
    netProfitUsd,
    buyFill: { filledBtc: 0.35, notional: 24_500, vwap: 70_000, complete: true, levelsUsed: [] },
    sellFill: { filledBtc: 0.35, notional: 24_500 + netProfitUsd + 42, vwap: 70_420, complete: true, levelsUsed: [] },
    impactCurve: [],
    microstructure: {
      buy: { midPrice: 70_000, spreadUsd: 8, spreadBps: 1.14, imbalance: 0.22, microprice: 70_006, pressure: "bid" },
      sell: { midPrice: 70_420, spreadUsd: 9, spreadBps: 1.28, imbalance: -0.18, microprice: 70_416, pressure: "ask" },
    },
    rejectionReasons: status === "accepted" ? [] : ["fixture rejection"],
    risk: {
      score: Math.round(positivePnlProbability * 100),
      latencyPenaltyUsd: 7,
      feeCostUsd: 22,
      withdrawalCostUsd: 13,
      grossProfitUsd: netProfitUsd + 42,
      positivePnlProbability,
      reasons: ["fixture"],
    },
    explanation: "fixture",
  };
}

function conviction(recommendation: EdgeConviction["recommendation"], posteriorProbability: number): EdgeConviction {
  return {
    posteriorProbability,
    confidenceInterval: { low: Math.max(0, posteriorProbability - 0.08), high: Math.min(1, posteriorProbability + 0.08) },
    evidenceScore: Math.round(posteriorProbability * 100),
    recommendation,
    factors: [],
    explanation: "fixture",
  };
}

function latency(
  policy: LatencyAlphaRace["summary"]["policy"],
  survivalProbability: number,
  expectedCaptureUsd: number,
  raceScore: number,
): LatencyAlphaRace {
  return {
    generatedAt: 1_780_000_000_000,
    route: "COINBASE -> KRAKEN",
    quoteAsset: "USD",
    curve: [],
    factors: [],
    reasons: ["fixture"],
    summary: {
      policy,
      ourRaceLatencyMs: policy === "reject-race-lost" ? 1_200 : 120,
      competitorArrivalMs: 90,
      edgeHalfLifeMs: policy === "reject-race-lost" ? 110 : 1_800,
      aggressiveFlowBtcPerSecond: policy === "reject-race-lost" ? 0.62 : 0.03,
      survivalProbability,
      expectedCaptureUsd,
      tailRiskUsd: policy === "reject-race-lost" ? 55 : 8,
      raceScore,
    },
    equation: "fixture",
  };
}

function hawkes(
  policy: HawkesFlowShockOracle["summary"]["policy"],
  branchingRatio: number,
  aftershockProbability: number,
): HawkesFlowShockOracle {
  return {
    generatedAt: 1_780_000_000_000,
    venues: [],
    reasons: ["fixture"],
    summary: {
      policy,
      branchingRatio,
      aftershockProbability,
      expectedShockBtc: policy === "halt-shock" ? 0.8 : 0.04,
      shockHalfLifeSeconds: policy === "halt-shock" ? 8.4 : 1.2,
      topDepthCoveragePct: policy === "halt-shock" ? 144 : 12,
      sourceCount: 2,
    },
    equation: "fixture",
  };
}

function mirage(
  policy: LiquidityMirageDetector["summary"]["policy"],
  mirageScore: number,
  executableEdgeRetainedPct: number,
): LiquidityMirageDetector {
  const profile = {
    side: "buy" as const,
    exchange: "coinbase",
    complete: true,
    topPrice: 70_000,
    vwap: 70_010,
    topLevelBtc: 0.18,
    filledBtc: 0.35,
    levelsUsed: 3,
    slippageBps: 1.4,
    concentrationPct: 51,
    cliffBps: 2.1,
  };
  return {
    generatedAt: 1_780_000_000_000,
    buy: profile,
    sell: { ...profile, side: "sell", exchange: "kraken" },
    riskFactors: [],
    reasons: ["fixture"],
    summary: {
      policy,
      mirageScore,
      executableEdgeRetainedPct,
      depthConvexityBps: mirageScore / 2,
      topOfBookEdgeBps: 64,
      vwapEdgeBps: 64 * (executableEdgeRetainedPct / 100),
      concentrationPct: 51,
      smartRouterConfirmation: policy === "halt-mirage" ? 12 : 76,
    },
    equation: "fixture",
  };
}

function governor(state: RiskGovernor["state"], score: number): RiskGovernor {
  return {
    state,
    score,
    action: state === "halt" ? "Block simulated execution until clear." : "fixture",
    rules: state === "halt" ? [{ id: "halt", label: "Fixture halt", state: "halt", message: "hard blocker" }] : [],
  };
}

function walkForward(policy: WalkForwardRobustness["summary"]["policy"], generalizationRatio: number): WalkForwardRobustness {
  return {
    generatedAt: 1_780_000_000_000,
    trainWindow: { tradeCount: 12 },
    testWindow: { tradeCount: 8 },
    candidates: [],
    summary: {
      policy,
      selectedMinSpreadBps: 14,
      trainScore: 82,
      testScore: Math.round(82 * generalizationRatio),
      generalizationRatio,
      outOfSamplePnlUsd: policy === "reject-overfit" ? -44 : 120,
      outOfSampleWinRate: policy === "reject-overfit" ? 0.28 : 0.75,
      overfitPenalty: policy === "reject-overfit" ? 88 : 24,
    },
    reasons: ["fixture"],
    equation: "fixture",
  };
}

function causal(
  finalDecision: CausalExecutionGraph["summary"]["finalDecision"],
  supportScore: number,
  dragScore: number,
  blockerCount: number,
): CausalExecutionGraph {
  return {
    generatedAt: 1_780_000_000_000,
    nodes: [],
    edges: [],
    rejectionReasons: blockerCount ? ["fixture hard blocker"] : [],
    summary: {
      finalDecision,
      supportScore,
      dragScore,
      blockerCount,
      explanation: "fixture",
    },
    equation: "fixture",
  };
}

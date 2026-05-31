import { describe, expect, it } from "vitest";
import { buildCausalExecutionGraph } from "./causal-execution-graph";
import type { EdgeConviction } from "./edge-conviction";
import type { ExecutionPlaybook } from "./execution-playbook";
import type { LatencyAlphaRace } from "./latency-alpha-race";
import type { RiskGovernor } from "./risk-governor";
import type { OpportunityDecision } from "./types";
import type { WalkForwardRobustness } from "./walk-forward";

describe("buildCausalExecutionGraph", () => {
  it("executes in simulation when market edge, validation, latency, playbook, and risk gates agree", () => {
    const graph = buildCausalExecutionGraph({
      decision: decision("accepted", 84),
      governor: governor("normal", 94),
      edgeConviction: conviction("simulate-execute", 0.81),
      latencyAlphaRace: race("cross-now", 76, 67),
      walkForwardRobustness: walkForward("deploy", 0.91),
      executionPlaybook: playbook("smart-route", 88, []),
    });

    expect(graph.summary.finalDecision).toBe("execute-simulated");
    expect(graph.summary.blockerCount).toBe(0);
    expect(graph.summary.supportScore).toBeGreaterThan(graph.summary.dragScore);
    expect(graph.summary.weakestLink?.state).not.toBe("blocker");
    expect(graph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["market-edge", "walk-forward", "latency-race", "risk-governor", "execution-playbook", "final-decision"]),
    );
    expect(graph.edges.some((edge) => edge.from === "latency-race" && edge.to === "execution-playbook")).toBe(true);
    expect(graph.equation).toContain("decision_score");
  });

  it("halts simulation when blockers prove the apparent edge is not executable", () => {
    const graph = buildCausalExecutionGraph({
      decision: decision("accepted", 42),
      governor: governor("halt", 18),
      edgeConviction: conviction("reject", 0.31),
      latencyAlphaRace: race("reject-race-lost", 24, -11),
      walkForwardRobustness: walkForward("reject-overfit", 0.22),
      executionPlaybook: playbook("halt", 100, ["execution regime halt", "venue failure halt-route"]),
    });

    expect(graph.summary.finalDecision).toBe("halt-simulated");
    expect(graph.summary.blockerCount).toBeGreaterThanOrEqual(4);
    expect(graph.summary.weakestLink?.state).toBe("blocker");
    expect(graph.summary.explanation).toContain("blocker");
    expect(graph.nodes.filter((node) => node.state === "blocker").map((node) => node.id)).toEqual(
      expect.arrayContaining(["risk-governor", "latency-race", "walk-forward", "execution-playbook"]),
    );
    expect(graph.rejectionReasons.join(" ")).toContain("overfit");
    expect(graph.rejectionReasons.join(" ")).toContain("latency");
  });
});

function decision(status: OpportunityDecision["status"], netProfitUsd: number): OpportunityDecision {
  return {
    id: `decision-${status}`,
    status,
    buyExchange: "coinbase",
    sellExchange: "kraken",
    quoteAsset: "USD",
    observedAt: 1_700_000_000_000,
    tradeSizeBtc: 0.25,
    grossProfitUsd: netProfitUsd + 30,
    netProfitUsd,
    buyFill: { filledBtc: 0.25, notional: 18_000, vwap: 72_000, complete: true, levelsUsed: [] },
    sellFill: { filledBtc: 0.25, notional: 18_084, vwap: 72_336, complete: true, levelsUsed: [] },
    impactCurve: [],
    microstructure: {
      buy: { midPrice: 72_000, spreadUsd: 4, spreadBps: 0.56, imbalance: 0.18, microprice: 72_002, pressure: "bid" },
      sell: { midPrice: 72_336, spreadUsd: 5, spreadBps: 0.69, imbalance: -0.14, microprice: 72_334, pressure: "ask" },
    },
    rejectionReasons: status === "accepted" ? [] : ["negative net P&L"],
    risk: {
      score: status === "accepted" ? 86 : 22,
      latencyPenaltyUsd: 5,
      feeCostUsd: 18,
      withdrawalCostUsd: 7,
      grossProfitUsd: netProfitUsd + 30,
      positivePnlProbability: status === "accepted" ? 0.78 : 0.22,
      reasons: ["fixture"],
    },
    explanation: "fixture",
  };
}

function governor(state: RiskGovernor["state"], score: number): RiskGovernor {
  return {
    state,
    score,
    action: state === "halt" ? "Block simulated execution until the blocking condition clears." : "Execution policy allows normal simulated sizing.",
    rules: state === "halt" ? [{ id: "fixture-halt", label: "Fixture halt", state: "halt", message: "fixture hard stop" }] : [],
  };
}

function conviction(recommendation: EdgeConviction["recommendation"], posteriorProbability: number): EdgeConviction {
  return {
    posteriorProbability,
    confidenceInterval: { low: Math.max(0, posteriorProbability - 0.1), high: Math.min(1, posteriorProbability + 0.1) },
    evidenceScore: recommendation === "simulate-execute" ? 82 : 32,
    recommendation,
    factors: [],
    explanation: "fixture",
  };
}

function race(policy: LatencyAlphaRace["summary"]["policy"], raceScore: number, expectedCaptureUsd: number): LatencyAlphaRace {
  return {
    generatedAt: 1_700_000_000_000,
    route: "COINBASE -> KRAKEN",
    quoteAsset: "USD",
    curve: [],
    factors: [],
    reasons: policy === "reject-race-lost" ? ["latency race requires caution", "expected capture is negative after race tail risk"] : ["race edge survives measured latency"],
    summary: {
      policy,
      ourRaceLatencyMs: policy === "reject-race-lost" ? 980 : 95,
      competitorArrivalMs: 80,
      edgeHalfLifeMs: policy === "reject-race-lost" ? 120 : 1_600,
      aggressiveFlowBtcPerSecond: policy === "reject-race-lost" ? 0.5 : 0.02,
      survivalProbability: policy === "reject-race-lost" ? 0.18 : 0.79,
      expectedCaptureUsd,
      tailRiskUsd: policy === "reject-race-lost" ? 24 : 3,
      raceScore,
    },
    equation: "fixture",
  };
}

function walkForward(policy: WalkForwardRobustness["summary"]["policy"], generalizationRatio: number): WalkForwardRobustness {
  return {
    generatedAt: 1_700_000_000_000,
    trainWindow: { tradeCount: 9 },
    testWindow: { tradeCount: 6 },
    candidates: [],
    selected: undefined,
    summary: {
      policy,
      selectedMinSpreadBps: 16,
      trainScore: 78,
      testScore: Math.round(78 * generalizationRatio),
      generalizationRatio,
      outOfSamplePnlUsd: policy === "reject-overfit" ? -18 : 136,
      outOfSampleWinRate: policy === "reject-overfit" ? 0.2 : 0.83,
      overfitPenalty: policy === "reject-overfit" ? 82 : 9,
    },
    reasons: policy === "reject-overfit" ? ["out-of-sample failure indicates overfit strategy"] : ["out-of-sample performance supports simulated deployment"],
    equation: "fixture",
  };
}

function playbook(
  recommendedAction: ExecutionPlaybook["summary"]["recommendedAction"],
  actionScore: number,
  hardStops: string[],
): ExecutionPlaybook {
  return {
    generatedAt: 1_700_000_000_000,
    actions: [
      {
        id: recommendedAction,
        label: recommendedAction,
        expectedPnlUsd: recommendedAction === "halt" ? 0 : 72,
        riskScore: recommendedAction === "halt" ? 8 : 84,
        confidence: recommendedAction === "halt" ? 94 : 80,
        actionScore,
        simulatedOnly: true,
        reasons: hardStops.length ? hardStops : ["fixture action"],
      },
    ],
    summary: {
      recommendedAction,
      expectedPnlUsd: recommendedAction === "halt" ? 0 : 72,
      riskScore: recommendedAction === "halt" ? 8 : 84,
      confidence: recommendedAction === "halt" ? 94 : 80,
      hardStops,
      explainabilityScore: 92,
    },
    equation: "fixture",
  };
}

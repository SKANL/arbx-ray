import { describe, expect, it } from "vitest";
import { buildExecutionPlaybook } from "./execution-playbook";
import type { ExecutionRegimeFusion } from "./execution-regime";
import type { QueuePositionOracle } from "./queue-position";
import type { SmartOrderRouterPlan } from "./smart-order-router";
import type { OpportunityDecision } from "./types";
import type { VenueFailureWarGame } from "./venue-failure";

describe("buildExecutionPlaybook", () => {
  it("recommends smart routing when split routing improves P&L and risk gates allow execution", () => {
    const playbook = buildExecutionPlaybook({
      decision: decision(18),
      smartOrderRouter: smartRouter("split-route", 34, 16),
      queuePosition: queue("cross-now", 18, 12),
      venueFailureWarGame: failure("failover-required"),
      executionRegime: regime("simulate-execute", 88),
    });

    expect(playbook.summary.recommendedAction).toBe("smart-route");
    expect(playbook.actions[0]?.id).toBe("smart-route");
    expect(playbook.actions[0]?.expectedPnlUsd).toBeGreaterThan(30);
    expect(playbook.actions[0]?.reasons).toContain("multi-venue route improves over single route");
    expect(playbook.equation).toContain("action_score");
  });

  it("promotes halt over profitable actions when hard-stop evidence is present", () => {
    const playbook = buildExecutionPlaybook({
      decision: decision(25),
      smartOrderRouter: smartRouter("split-route", 55, 30),
      queuePosition: queue("post-both-legs", 62, 37),
      venueFailureWarGame: failure("halt-route"),
      executionRegime: regime("halt", 22),
    });

    expect(playbook.summary.recommendedAction).toBe("halt");
    expect(playbook.actions[0]?.id).toBe("halt");
    expect(playbook.actions[0]?.riskScore).toBeLessThan(25);
    expect(playbook.summary.hardStops).toContain("execution regime halt");
    expect(playbook.summary.hardStops).toContain("venue failure halt-route");
  });
});

function decision(netProfitUsd: number): OpportunityDecision {
  return {
    id: "decision",
    status: "accepted",
    buyExchange: "coinbase",
    sellExchange: "kraken",
    quoteAsset: "USD",
    observedAt: 1_700_000_000_000,
    tradeSizeBtc: 0.25,
    grossProfitUsd: netProfitUsd + 12,
    netProfitUsd,
    buyFill: { filledBtc: 0.25, notional: 18_250, vwap: 73_000, complete: true, levelsUsed: [] },
    sellFill: { filledBtc: 0.25, notional: 18_300, vwap: 73_200, complete: true, levelsUsed: [] },
    impactCurve: [],
    microstructure: {
      buy: { midPrice: 73_000, spreadUsd: 10, spreadBps: 1.4, imbalance: 0, microprice: 73_000, pressure: "neutral" },
      sell: { midPrice: 73_200, spreadUsd: 10, spreadBps: 1.4, imbalance: 0, microprice: 73_200, pressure: "neutral" },
    },
    rejectionReasons: [],
    risk: {
      score: 82,
      latencyPenaltyUsd: 2,
      feeCostUsd: 9,
      withdrawalCostUsd: 1,
      grossProfitUsd: netProfitUsd + 12,
      positivePnlProbability: 0.74,
      reasons: ["fixture"],
    },
    explanation: "fixture",
  };
}

function smartRouter(policy: SmartOrderRouterPlan["summary"]["policy"], netProfitUsd: number, improvementUsd: number): SmartOrderRouterPlan {
  return {
    generatedAt: 1_700_000_000_000,
    targetSizeBtc: 0.25,
    quoteAsset: "USD",
    buySlices: [],
    sellSlices: [],
    rejectionReasons: [],
    summary: {
      policy,
      tradeSizeBtc: 0.25,
      buyVwap: 73_000,
      sellVwap: 73_200,
      grossProfitUsd: netProfitUsd + 12,
      feeCostUsd: 9,
      reliabilityHaircutUsd: 0,
      rebalanceCostUsd: 1,
      netProfitUsd,
      bestSingleRouteNetUsd: netProfitUsd - improvementUsd,
      improvementUsd,
      venuesUsed: policy === "split-route" ? 4 : 2,
      sourceCount: 7,
    },
    equation: "fixture",
  };
}

function queue(
  recommendation: QueuePositionOracle["summary"]["recommendation"],
  expectedMakerNetUsd: number,
  expectedImprovementUsd: number,
): QueuePositionOracle {
  return {
    generatedAt: 1_700_000_000_000,
    horizonMs: 12_000,
    buyLeg: {} as QueuePositionOracle["buyLeg"],
    sellLeg: {} as QueuePositionOracle["sellLeg"],
    summary: {
      recommendation,
      takerNetUsd: expectedMakerNetUsd - expectedImprovementUsd,
      expectedMakerNetUsd,
      expectedImprovementUsd,
      combinedFillProbability: recommendation === "post-both-legs" ? 0.82 : 0.45,
      toxicFlowPenaltyUsd: recommendation === "cross-now" ? 8 : 2,
    },
    equation: "fixture",
  };
}

function failure(policy: VenueFailureWarGame["summary"]["policy"]): VenueFailureWarGame {
  return {
    generatedAt: 1_700_000_000_000,
    scenarios: [],
    summary: {
      policy,
      worstLossUsd: policy === "halt-route" ? -500 : -45,
      trappedCapitalUsd: policy === "halt-route" ? 30_000 : 1_000,
      failoverVenues: policy === "failover-required" ? ["gemini"] : [],
      haltedScenarios: policy === "halt-route" ? 2 : 0,
    },
    equation: "fixture",
  };
}

function regime(action: ExecutionRegimeFusion["action"], score: number): ExecutionRegimeFusion {
  return {
    score,
    action,
    confidence: score > 75 ? "high" : "medium",
    combinedHaircutBps: action === "halt" ? 20 : 4,
    hardStops: action === "halt" ? ["fixture halt"] : [],
    factors: [],
    formula: "fixture",
    sources: ["fixture"],
  };
}

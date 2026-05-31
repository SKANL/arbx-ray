import { describe, expect, it } from "vitest";
import { buildLiquidityMirageDetector } from "./liquidity-mirage";
import type { SmartOrderRouterPlan } from "./smart-order-router";
import type { OpportunityDecision } from "./types";

describe("buildLiquidityMirageDetector", () => {
  it("allows execution when depth is smooth, fills complete, and smart routing improves the route", () => {
    const detector = buildLiquidityMirageDetector({
      decision: decision({
        netProfitUsd: 76,
        buyLevels: [
          [72_000, 0.18],
          [72_006, 0.16],
          [72_011, 0.15],
          [72_018, 0.14],
        ],
        sellLevels: [
          [72_380, 0.17],
          [72_374, 0.16],
          [72_368, 0.15],
          [72_361, 0.14],
        ],
      }),
      smartOrderRouter: router("split-route", 92, 24, 4),
    });

    expect(detector.summary.policy).toBe("allow");
    expect(detector.summary.mirageScore).toBeLessThan(30);
    expect(detector.summary.depthConvexityBps).toBeLessThan(10);
    expect(detector.summary.executableEdgeRetainedPct).toBeGreaterThan(70);
    expect(detector.riskFactors.some((factor) => factor.id === "depth-cliff" && factor.state === "pass")).toBe(true);
    expect(detector.equation).toContain("mirage_score");
  });

  it("halts a positive top-level edge when liquidity is concentrated, incomplete, and collapses after depth walk", () => {
    const detector = buildLiquidityMirageDetector({
      decision: decision({
        netProfitUsd: 8,
        buyComplete: false,
        sellComplete: false,
        buyLevels: [
          [72_000, 0.01],
          [72_280, 0.02],
          [72_760, 0.03],
        ],
        sellLevels: [
          [72_420, 0.008],
          [72_120, 0.016],
          [71_650, 0.02],
        ],
      }),
      smartOrderRouter: router("reject", -18, -35, 1),
    });

    expect(detector.summary.policy).toBe("halt-mirage");
    expect(detector.summary.mirageScore).toBeGreaterThanOrEqual(75);
    expect(detector.summary.executableEdgeRetainedPct).toBeLessThan(35);
    expect(detector.summary.depthConvexityBps).toBeGreaterThan(60);
    expect(detector.riskFactors.filter((factor) => factor.state === "fail").map((factor) => factor.id)).toEqual(
      expect.arrayContaining(["partial-fill", "depth-cliff", "edge-retention", "router-confirmation"]),
    );
    expect(detector.reasons.join(" ")).toContain("liquidity mirage");
  });
});

function decision(input: {
  netProfitUsd: number;
  buyLevels: Array<[price: number, sizeBtc: number]>;
  sellLevels: Array<[price: number, sizeBtc: number]>;
  buyComplete?: boolean;
  sellComplete?: boolean;
}): OpportunityDecision {
  const buyFill = fill(input.buyLevels, input.buyComplete ?? true);
  const sellFill = fill(input.sellLevels, input.sellComplete ?? true);
  const topEdge = input.sellLevels[0][0] - input.buyLevels[0][0];
  return {
    id: "mirage-fixture",
    status: "accepted",
    buyExchange: "coinbase",
    sellExchange: "kraken",
    quoteAsset: "USD",
    observedAt: 1_700_000_000_000,
    tradeSizeBtc: 0.25,
    grossProfitUsd: topEdge * 0.25,
    netProfitUsd: input.netProfitUsd,
    buyFill,
    sellFill,
    impactCurve: [
      { sizeBtc: 0.05, grossProfitUsd: topEdge * 0.05, netProfitUsd: input.netProfitUsd * 0.8, buyVwap: buyFill.vwap, sellVwap: sellFill.vwap, accepted: true },
      { sizeBtc: 0.25, grossProfitUsd: topEdge * 0.25, netProfitUsd: input.netProfitUsd, buyVwap: buyFill.vwap, sellVwap: sellFill.vwap, accepted: input.netProfitUsd > 0 },
    ],
    microstructure: {
      buy: { midPrice: input.buyLevels[0][0], spreadUsd: 4, spreadBps: 0.55, imbalance: 0.1, microprice: input.buyLevels[0][0], pressure: "neutral" },
      sell: { midPrice: input.sellLevels[0][0], spreadUsd: 5, spreadBps: 0.69, imbalance: -0.1, microprice: input.sellLevels[0][0], pressure: "neutral" },
    },
    rejectionReasons: [],
    risk: {
      score: input.netProfitUsd > 20 ? 82 : 38,
      latencyPenaltyUsd: 4,
      feeCostUsd: 18,
      withdrawalCostUsd: 7,
      grossProfitUsd: topEdge * 0.25,
      positivePnlProbability: input.netProfitUsd > 20 ? 0.78 : 0.52,
      reasons: ["fixture"],
    },
    explanation: "fixture",
  };
}

function fill(levels: Array<[price: number, sizeBtc: number]>, complete: boolean): OpportunityDecision["buyFill"] {
  const levelsUsed = levels.map(([price, size]) => ({
    price,
    requestedBtc: 0.25,
    filledBtc: size,
    notional: price * size,
  }));
  const filledBtc = levelsUsed.reduce((sum, level) => sum + level.filledBtc, 0);
  const notional = levelsUsed.reduce((sum, level) => sum + level.notional, 0);
  return {
    filledBtc,
    notional,
    vwap: filledBtc > 0 ? notional / filledBtc : 0,
    complete,
    levelsUsed,
  };
}

function router(
  policy: SmartOrderRouterPlan["summary"]["policy"],
  netProfitUsd: number,
  improvementUsd: number,
  venuesUsed: number,
): SmartOrderRouterPlan {
  return {
    generatedAt: 1_700_000_000_000,
    targetSizeBtc: 0.25,
    quoteAsset: "USD",
    buySlices: [],
    sellSlices: [],
    rejectionReasons: policy === "reject" ? ["negative smart-route net after costs"] : [],
    summary: {
      policy,
      tradeSizeBtc: policy === "reject" ? 0.08 : 0.25,
      buyVwap: 72_000,
      sellVwap: 72_350,
      grossProfitUsd: netProfitUsd + 30,
      feeCostUsd: 18,
      reliabilityHaircutUsd: 1,
      rebalanceCostUsd: 11,
      netProfitUsd,
      bestSingleRouteNetUsd: netProfitUsd - improvementUsd,
      improvementUsd,
      venuesUsed,
      sourceCount: 7,
    },
    equation: "fixture",
  };
}

import { describe, expect, it } from "vitest";
import { buildHawkesFlowShockOracle } from "./hawkes-flow";
import type { TradeTapeToxicity, TradeTapeVenueSummary } from "./trade-tape";

describe("buildHawkesFlowShockOracle", () => {
  it("allows execution when flow is balanced and not self-exciting", () => {
    const oracle = buildHawkesFlowShockOracle({
      tradeTape: tape([
        venue("coinbase", "benign", 18, 0.04, 24, 0.02, 0.08, 0.08),
        venue("kraken", "benign", 16, -0.03, 22, -0.01, 0.07, 0.07),
      ]),
      observedAt: 1_700_000_000_000,
    });

    expect(oracle.summary.policy).toBe("allow");
    expect(oracle.summary.branchingRatio).toBeLessThan(0.35);
    expect(oracle.summary.aftershockProbability).toBeLessThan(0.35);
    expect(oracle.venues.every((item) => item.state === "benign")).toBe(true);
    expect(oracle.equation).toContain("branching_ratio");
  });

  it("halts when aggressive flow is self-exciting and expected aftershock overwhelms liquidity", () => {
    const oracle = buildHawkesFlowShockOracle({
      tradeTape: tape([
        venue("coinbase", "toxic", 92, 0.92, 210, 34, 5.8, 0.14),
        venue("kraken", "toxic", 86, 0.81, 180, 27, 4.7, 0.12),
      ]),
      topDepthBtc: 0.18,
      observedAt: 1_700_000_000_000,
    });

    expect(oracle.summary.policy).toBe("halt-shock");
    expect(oracle.summary.branchingRatio).toBeGreaterThan(0.8);
    expect(oracle.summary.aftershockProbability).toBeGreaterThan(0.7);
    expect(oracle.summary.expectedShockBtc).toBeGreaterThan(0.18);
    expect(oracle.venues.map((item) => item.state)).toEqual(["critical", "critical"]);
    expect(oracle.reasons.join(" ")).toContain("self-exciting");
  });
});

function tape(venues: TradeTapeVenueSummary[]): TradeTapeToxicity {
  return {
    generatedAt: 1_700_000_000_000,
    windowMs: 60_000,
    venues,
    summary: {
      venueCount: venues.length,
      tradeCount: venues.reduce((sum, item) => sum + item.tradeCount, 0),
      combinedScore: venues.reduce((sum, item) => sum + item.toxicityScore, 0) / venues.length,
      toxicVenues: venues.filter((item) => item.state === "toxic").length,
      watchVenues: venues.filter((item) => item.state === "watch").length,
      recommendation: venues.some((item) => item.state === "toxic") ? "halt-fast-flow" : "allow",
    },
    sources: ["fixture trades"],
    errors: [],
  };
}

function venue(
  exchangeId: "coinbase" | "kraken",
  state: TradeTapeVenueSummary["state"],
  toxicityScore: number,
  imbalance: number,
  tradesPerMinute: number,
  priceDriftBps: number,
  dominantAggressorBtc: number,
  passiveAggressorBtc: number,
): TradeTapeVenueSummary {
  const buyDominant = imbalance >= 0;
  return {
    exchangeId,
    symbol: exchangeId === "coinbase" ? "BTC-USD" : "BTC/USD",
    tradeCount: Math.round(tradesPerMinute),
    buyAggressorBtc: buyDominant ? dominantAggressorBtc : passiveAggressorBtc,
    sellAggressorBtc: buyDominant ? passiveAggressorBtc : dominantAggressorBtc,
    signedVolumeBtc: buyDominant ? dominantAggressorBtc - passiveAggressorBtc : passiveAggressorBtc - dominantAggressorBtc,
    imbalance,
    tradesPerMinute,
    averageTradeBtc: (dominantAggressorBtc + passiveAggressorBtc) / Math.max(1, Math.round(tradesPerMinute)),
    priceDriftBps,
    firstPrice: 72_000,
    lastPrice: 72_000 * (1 + priceDriftBps / 10_000),
    toxicityScore,
    state,
    recommendation: state === "toxic" ? "halt-fast-flow" : state === "watch" ? "cap-size" : "allow",
    explanation: "fixture",
  };
}

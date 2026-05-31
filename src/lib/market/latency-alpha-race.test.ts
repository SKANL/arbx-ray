import { describe, expect, it } from "vitest";
import { buildLatencyAlphaRace } from "./latency-alpha-race";
import type { TradeTapeToxicity, TradeTapeVenueSummary } from "./trade-tape";
import type { OpportunityDecision } from "./types";
import type { VenueLatencyRace, VenueLatencyScore } from "./venue-latency";

describe("buildLatencyAlphaRace", () => {
  it("keeps the route executable when measured latency is fast and aggressive flow is benign", () => {
    const race = buildLatencyAlphaRace({
      decision: decision({ netProfitUsd: 148, buyTopBtc: 0.9, sellTopBtc: 0.8 }),
      venueLatency: latencyRace(85, 105),
      tradeTape: tape("benign", 12, 0.03, 1.5),
      realizedVolBpsPerSecond: 3,
    });

    expect(race.summary.policy).toBe("cross-now");
    expect(race.summary.survivalProbability).toBeGreaterThan(0.65);
    expect(race.summary.expectedCaptureUsd).toBeGreaterThan(80);
    expect(race.curve[0]?.survivalProbability).toBeGreaterThan(race.curve.at(-1)?.survivalProbability ?? 0);
    expect(race.equation).toContain("survival_probability");
  });

  it("rejects a positive spread when toxic flow and slow venue latency imply the race is lost", () => {
    const race = buildLatencyAlphaRace({
      decision: decision({ netProfitUsd: 26, buyTopBtc: 0.08, sellTopBtc: 0.07 }),
      venueLatency: latencyRace(920, 1_180),
      tradeTape: tape("toxic", 84, 0.92, 38),
      realizedVolBpsPerSecond: 18,
    });

    expect(race.summary.policy).toBe("reject-race-lost");
    expect(race.summary.survivalProbability).toBeLessThan(0.35);
    expect(race.summary.expectedCaptureUsd).toBeLessThan(0);
    expect(race.reasons.join(" ")).toContain("aggressive flow");
    expect(race.reasons.join(" ")).toContain("latency");
  });
});

function decision(input: { netProfitUsd: number; buyTopBtc: number; sellTopBtc: number }): OpportunityDecision {
  return {
    id: "race-test",
    status: "accepted",
    buyExchange: "coinbase",
    sellExchange: "kraken",
    quoteAsset: "USD",
    observedAt: 1_700_000_000_000,
    tradeSizeBtc: 0.25,
    grossProfitUsd: input.netProfitUsd + 42,
    netProfitUsd: input.netProfitUsd,
    buyFill: {
      filledBtc: 0.25,
      notional: 18_200,
      vwap: 72_800,
      complete: true,
      levelsUsed: [{ price: 72_800, requestedBtc: 0.25, filledBtc: input.buyTopBtc, notional: 72_800 * input.buyTopBtc }],
    },
    sellFill: {
      filledBtc: 0.25,
      notional: 18_348,
      vwap: 73_392,
      complete: true,
      levelsUsed: [{ price: 73_392, requestedBtc: 0.25, filledBtc: input.sellTopBtc, notional: 73_392 * input.sellTopBtc }],
    },
    impactCurve: [],
    microstructure: {
      buy: { midPrice: 72_790, spreadUsd: 2, spreadBps: 0.27, imbalance: 0.15, microprice: 72_791, pressure: "bid" },
      sell: { midPrice: 73_390, spreadUsd: 2.5, spreadBps: 0.34, imbalance: -0.1, microprice: 73_389, pressure: "ask" },
    },
    rejectionReasons: [],
    risk: {
      score: 86,
      latencyPenaltyUsd: 7,
      feeCostUsd: 18,
      withdrawalCostUsd: 10,
      grossProfitUsd: input.netProfitUsd + 42,
      positivePnlProbability: 0.82,
      reasons: ["same quote lane: USD"],
    },
    explanation: "test",
  };
}

function latencyRace(coinbaseP95: number, krakenP95: number): VenueLatencyRace {
  const venues = [
    venue("coinbase", coinbaseP95),
    venue("kraken", krakenP95),
    venue("binance", 180),
  ];
  return {
    generatedAt: 1_700_000_000_000,
    latencyBudgetMs: 900,
    notionalUsd: 18_300,
    realizedVolBpsPerSecond: 4,
    venues,
    summary: {
      venueCount: venues.length,
      fastestVenue: "binance",
      lowestPenaltyUsd: 0.2,
      degradedVenues: venues.filter((item) => item.status !== "pass").length,
      medianP95Ms: 180,
      bestScore: 92,
    },
    sources: ["public latency probes"],
    errors: [],
  };
}

function venue(venueName: string, p95Ms: number): VenueLatencyScore {
  return {
    venue: venueName,
    label: venueName,
    endpoint: `https://${venueName}.example.test`,
    samples: [{ ok: true, ms: p95Ms }],
    p50Ms: p95Ms * 0.55,
    p95Ms,
    maxMs: p95Ms,
    jitterMs: p95Ms * 0.45,
    availabilityPct: 100,
    latencyPenaltyUsd: p95Ms / 100,
    score: Math.max(0, 100 - p95Ms / 12),
    status: p95Ms < 500 ? "pass" : p95Ms < 900 ? "watch" : "fail",
    reason: `${venueName} p95 ${p95Ms}ms`,
  };
}

function tape(state: TradeTapeVenueSummary["state"], toxicityScore: number, imbalance: number, tradesPerMinute: number): TradeTapeToxicity {
  const venues = [
    tapeVenue("coinbase", state, toxicityScore, imbalance, tradesPerMinute),
    tapeVenue("kraken", state, toxicityScore, -imbalance, tradesPerMinute * 0.9),
  ];
  return {
    generatedAt: 1_700_000_000_000,
    windowMs: 60_000,
    venues,
    summary: {
      venueCount: venues.length,
      tradeCount: 120,
      combinedScore: toxicityScore,
      toxicVenues: state === "toxic" ? 2 : 0,
      watchVenues: state === "watch" ? 2 : 0,
      recommendation: state === "toxic" ? "halt-fast-flow" : state === "watch" ? "cap-size" : "allow",
    },
    sources: ["coinbase trades", "kraken trades"],
    errors: [],
  };
}

function tapeVenue(
  exchangeId: "coinbase" | "kraken",
  state: TradeTapeVenueSummary["state"],
  toxicityScore: number,
  imbalance: number,
  tradesPerMinute: number,
): TradeTapeVenueSummary {
  return {
    exchangeId,
    symbol: exchangeId === "coinbase" ? "BTC-USD" : "BTC/USD",
    tradeCount: 60,
    buyAggressorBtc: imbalance > 0 ? 3 : 1,
    sellAggressorBtc: imbalance < 0 ? 3 : 1,
    signedVolumeBtc: imbalance * 4,
    imbalance,
    tradesPerMinute,
    averageTradeBtc: 0.04,
    priceDriftBps: imbalance * 8,
    firstPrice: 72_900,
    lastPrice: 72_900 * (1 + (imbalance * 8) / 10_000),
    toxicityScore,
    state,
    recommendation: state === "toxic" ? "halt-fast-flow" : state === "watch" ? "cap-size" : "allow",
    explanation: `${exchangeId} test tape`,
  };
}

import { describe, expect, it } from "vitest";
import { buildRiskGovernor } from "./risk-governor";
import type { MarketContext } from "./context";
import type { FeedHealth, OpportunityDecision } from "./types";

const decision: OpportunityDecision = {
  id: "gov",
  status: "accepted",
  buyExchange: "kraken",
  sellExchange: "coinbase",
  quoteAsset: "USD",
  observedAt: 1,
  tradeSizeBtc: 0.5,
  grossProfitUsd: 250,
  netProfitUsd: 80,
  buyFill: { filledBtc: 0.5, notional: 35_000, vwap: 70_000, complete: true, levelsUsed: [] },
  sellFill: { filledBtc: 0.5, notional: 35_250, vwap: 70_500, complete: true, levelsUsed: [] },
  impactCurve: [],
  microstructure: {
    buy: { midPrice: 70_000, spreadUsd: 1, spreadBps: 0.14, imbalance: 0, microprice: 70_000, pressure: "neutral" },
    sell: { midPrice: 70_500, spreadUsd: 1, spreadBps: 0.14, imbalance: 0, microprice: 70_500, pressure: "neutral" },
  },
  rejectionReasons: [],
  risk: {
    score: 90,
    latencyPenaltyUsd: 1,
    feeCostUsd: 120,
    withdrawalCostUsd: 5,
    grossProfitUsd: 250,
    positivePnlProbability: 0.8,
    reasons: [],
  },
  explanation: "governor",
};

const context: MarketContext = {
  fetchedAt: 1,
  volatility: { source: "kraken-ohlc", intervalSeconds: 60, realizedVolBpsPerSecond: 1.5, closes: [1, 2, 3] },
  mempoolFees: { fastestFee: 4, halfHourFee: 3, hourFee: 2, economyFee: 1, minimumFee: 1 },
  sentiment: { value: 50, label: "Neutral", timestamp: 1 },
  sources: [],
  errors: [],
};

const health: FeedHealth[] = [
  { exchangeId: "kraken", status: "live", latencyMs: 30 },
  { exchangeId: "coinbase", status: "live", latencyMs: 40 },
];

describe("buildRiskGovernor", () => {
  it("allows normal execution when route, feeds, and stress scenarios are healthy", () => {
    const governor = buildRiskGovernor({
      decision,
      context,
      health,
      stressResults: [
        { id: "base", label: "base", stressedNetProfitUsd: 50, stressedProbability: 0.8, survives: true, explanation: "" },
      ],
    });

    expect(governor.state).toBe("normal");
    expect(governor.score).toBe(100);
  });

  it("halts when the route is rejected or stress survival fails", () => {
    const governor = buildRiskGovernor({
      decision: { ...decision, status: "rejected", rejectionReasons: ["Negative net expectancy"] },
      context,
      health,
      stressResults: [
        { id: "bad", label: "bad", stressedNetProfitUsd: -10, stressedProbability: 0.2, survives: false, explanation: "" },
      ],
    });

    expect(governor.state).toBe("halt");
    expect(governor.rules.map((rule) => rule.id)).toContain("route-rejected");
    expect(governor.rules.map((rule) => rule.id)).toContain("stress-halt");
  });

  it("moves to caution for elevated network fees and stale minority feeds", () => {
    const governor = buildRiskGovernor({
      decision,
      context: {
        ...context,
        mempoolFees: { fastestFee: 30, halfHourFee: 20, hourFee: 10, economyFee: 5, minimumFee: 1 },
      },
      health: [...health, { exchangeId: "gemini", status: "stale", latencyMs: 2_000 }],
      stressResults: [
        { id: "base", label: "base", stressedNetProfitUsd: 50, stressedProbability: 0.8, survives: true, explanation: "" },
      ],
    });

    expect(governor.state).toBe("caution");
    expect(governor.rules.map((rule) => rule.id)).toContain("network-caution");
    expect(governor.rules.map((rule) => rule.id)).toContain("feed-caution");
  });
});

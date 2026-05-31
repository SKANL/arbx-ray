import { describe, expect, it } from "vitest";
import { buildEnginePublication } from "./engine-state";
import type { OpportunityDecision } from "./types";

function decision(id: string, observedAt: number): OpportunityDecision {
  return {
    id,
    status: "accepted",
    buyExchange: "kraken",
    sellExchange: "coinbase",
    quoteAsset: "USD",
    observedAt,
    tradeSizeBtc: 0.1,
    grossProfitUsd: 5,
    netProfitUsd: 2,
    buyFill: { filledBtc: 0.1, notional: 10_000, vwap: 100_000, complete: true, levelsUsed: [] },
    sellFill: { filledBtc: 0.1, notional: 10_005, vwap: 100_050, complete: true, levelsUsed: [] },
    impactCurve: [],
    microstructure: {
      buy: { midPrice: 100_000, spreadUsd: 1, spreadBps: 0.1, imbalance: 0, microprice: 100_000, pressure: "neutral" },
      sell: { midPrice: 100_050, spreadUsd: 1, spreadBps: 0.1, imbalance: 0, microprice: 100_050, pressure: "neutral" },
    },
    rejectionReasons: [],
    risk: {
      score: 90,
      latencyPenaltyUsd: 0,
      feeCostUsd: 1,
      withdrawalCostUsd: 0,
      grossProfitUsd: 5,
      positivePnlProbability: 0.9,
      reasons: [],
    },
    explanation: "test decision",
  };
}

describe("buildEnginePublication", () => {
  it("does not publish an old journal decision as the current best route", () => {
    const oldDecision = decision("old", 1_000);
    const publication = buildEnginePublication({
      currentBest: undefined,
      recent: [oldDecision],
      now: 11_000,
    });

    expect(publication.best).toBeUndefined();
    expect(publication.currentBest).toBeUndefined();
    expect(publication.latestDecision).toBe(oldDecision);
    expect(publication.routeState).toBe("no-current-route");
  });

  it("publishes freshness metadata for a current route", () => {
    const currentBest = decision("current", 9_500);
    const publication = buildEnginePublication({
      currentBest,
      recent: [decision("old", 1_000)],
      now: 10_000,
    });

    expect(publication.best).toBe(currentBest);
    expect(publication.latestDecision?.id).toBe("old");
    expect(publication.routeFreshnessMs).toBe(500);
    expect(publication.routeState).toBe("current-route");
  });
});

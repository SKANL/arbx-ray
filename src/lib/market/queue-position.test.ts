import { describe, expect, it } from "vitest";
import { buildQueuePositionOracle } from "./queue-position";
import type { TradeTapeToxicity } from "./trade-tape";
import type { OpportunityDecision, OrderBookSnapshot } from "./types";

describe("buildQueuePositionOracle", () => {
  it("recommends maker improvement when public trade flow can clear the queue within the horizon", () => {
    const oracle = buildQueuePositionOracle({
      decision: decision(),
      books: [
        book("coinbase", [[73_020, 1.2]], [[73_000, 0.08]]),
        book("kraken", [[73_210, 0.08]], [[73_180, 1.1]]),
      ],
      tape: tape({
        coinbase: { sellFlow: 0.35, buyFlow: 0.02, driftBps: -0.4, toxicityScore: 18 },
        kraken: { sellFlow: 0.03, buyFlow: 0.42, driftBps: 0.5, toxicityScore: 22 },
      }),
      horizonMs: 12_000,
    });

    expect(oracle.summary.recommendation).toBe("post-both-legs");
    expect(oracle.summary.expectedMakerNetUsd).toBeGreaterThan(oracle.summary.takerNetUsd);
    expect(oracle.buyLeg.fillProbability).toBeGreaterThan(0.75);
    expect(oracle.sellLeg.fillProbability).toBeGreaterThan(0.75);
    expect(oracle.equation).toContain("fill_probability");
  });

  it("crosses as taker when queue fill probability is weak and tape is toxic", () => {
    const oracle = buildQueuePositionOracle({
      decision: decision(),
      books: [
        book("coinbase", [[73_020, 2]], [[73_000, 2.5]]),
        book("kraken", [[73_210, 2.5]], [[73_180, 2]]),
      ],
      tape: tape({
        coinbase: { sellFlow: 0.01, buyFlow: 0.3, driftBps: 5, toxicityScore: 82 },
        kraken: { sellFlow: 0.28, buyFlow: 0.01, driftBps: -4, toxicityScore: 79 },
      }),
      horizonMs: 5_000,
    });

    expect(oracle.summary.recommendation).toBe("cross-now");
    expect(oracle.summary.expectedMakerNetUsd).toBeLessThan(oracle.summary.takerNetUsd);
    expect(oracle.buyLeg.adverseSelectionUsd).toBeGreaterThan(0);
    expect(oracle.sellLeg.reasons).toContain("low queue fill probability");
  });
});

function decision(): OpportunityDecision {
  return {
    id: "decision-1",
    status: "accepted",
    buyExchange: "coinbase",
    sellExchange: "kraken",
    quoteAsset: "USD",
    observedAt: 1_700_000_000_000,
    tradeSizeBtc: 0.1,
    grossProfitUsd: 18,
    netProfitUsd: 9,
    buyFill: { filledBtc: 0.1, notional: 7_302, vwap: 73_020, complete: true, levelsUsed: [] },
    sellFill: { filledBtc: 0.1, notional: 7_318, vwap: 73_180, complete: true, levelsUsed: [] },
    impactCurve: [],
    microstructure: {
      buy: { midPrice: 73_010, spreadUsd: 20, spreadBps: 2.74, imbalance: -0.4, microprice: 73_006, pressure: "ask" },
      sell: { midPrice: 73_195, spreadUsd: 30, spreadBps: 4.1, imbalance: 0.35, microprice: 73_200, pressure: "bid" },
    },
    rejectionReasons: [],
    risk: {
      score: 72,
      latencyPenaltyUsd: 1,
      feeCostUsd: 8,
      withdrawalCostUsd: 0,
      grossProfitUsd: 18,
      positivePnlProbability: 0.68,
      reasons: ["fixture"],
    },
    explanation: "fixture",
  };
}

function book(exchangeId: string, asks: Array<[number, number]>, bids: Array<[number, number]>): OrderBookSnapshot {
  return {
    exchangeId,
    symbol: "BTC-USD",
    baseAsset: "BTC",
    quoteAsset: "USD",
    asks: asks.map(([price, size]) => ({ price, size })),
    bids: bids.map(([price, size]) => ({ price, size })),
    receivedAt: 1_700_000_000_000,
  };
}

function tape(input: Record<string, { sellFlow: number; buyFlow: number; driftBps: number; toxicityScore: number }>): TradeTapeToxicity {
  return {
    generatedAt: 1_700_000_000_000,
    windowMs: 60_000,
    venues: Object.entries(input).map(([exchangeId, flow]) => {
      const sellAggressorBtc = flow.sellFlow * 60;
      const buyAggressorBtc = flow.buyFlow * 60;
      const total = sellAggressorBtc + buyAggressorBtc;
      return {
        exchangeId: exchangeId as never,
        symbol: "BTC-USD",
        tradeCount: 100,
        buyAggressorBtc,
        sellAggressorBtc,
        signedVolumeBtc: buyAggressorBtc - sellAggressorBtc,
        imbalance: total > 0 ? (buyAggressorBtc - sellAggressorBtc) / total : 0,
        tradesPerMinute: 100,
        averageTradeBtc: total / 100,
        priceDriftBps: flow.driftBps,
        firstPrice: 73_000,
        lastPrice: 73_000 * (1 + flow.driftBps / 10_000),
        toxicityScore: flow.toxicityScore,
        state: flow.toxicityScore >= 70 ? "toxic" : flow.toxicityScore >= 40 ? "watch" : "benign",
        recommendation: flow.toxicityScore >= 70 ? "halt-fast-flow" : flow.toxicityScore >= 40 ? "cap-size" : "allow",
        explanation: "fixture",
      };
    }),
    summary: {
      venueCount: Object.keys(input).length,
      tradeCount: 200,
      combinedScore: 50,
      toxicVenues: 0,
      watchVenues: 0,
      recommendation: "allow",
    },
    sources: ["fixture"],
    errors: [],
  };
}

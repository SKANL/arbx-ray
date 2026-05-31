import { describe, expect, it } from "vitest";
import { buildConformalExecutionGuard } from "./conformal-execution-guard";
import type { HistoricalReplay, HistoricalTrade } from "./historical";
import type { OpportunityDecision } from "./types";

describe("buildConformalExecutionGuard", () => {
  it("waits when there are not enough historical simulated trades to calibrate coverage", () => {
    const guard = buildConformalExecutionGuard({
      decision: decision({ netProfitUsd: 42, tradeSizeBtc: 0.2 }),
      replay: replay([12, 14, 16]),
      minSamples: 6,
    });

    expect(guard.summary.policy).toBe("insufficient-history");
    expect(guard.summary.sampleCount).toBe(3);
    expect(guard.summary.lowerBoundUsd).toBe(0);
    expect(guard.reasons).toContain("need at least 6 calibration trades");
  });

  it("executes when the conformal lower bound remains positive after the calibrated residual", () => {
    const guard = buildConformalExecutionGuard({
      decision: decision({ netProfitUsd: 48, tradeSizeBtc: 0.25 }),
      replay: replay([34, 35, 36, 37, 38, 39, 40, 41]),
      targetCoverage: 0.8,
      minSamples: 6,
    });

    expect(guard.summary.policy).toBe("execute");
    expect(guard.summary.sampleCount).toBe(8);
    expect(guard.summary.quantileResidualUsd).toBeGreaterThan(0);
    expect(guard.summary.lowerBoundUsd).toBeGreaterThan(0);
    expect(guard.summary.recommendedSizeBtc).toBe(0.25);
    expect(guard.equation).toContain("lower_bound");
  });

  it("caps size when nominal expected profit is positive but the conformal lower bound is negative", () => {
    const guard = buildConformalExecutionGuard({
      decision: decision({ netProfitUsd: 18, tradeSizeBtc: 0.4 }),
      replay: replay([50, 47, 9, 44, 8, 42, 7, 40]),
      targetCoverage: 0.8,
      minSamples: 6,
    });

    expect(guard.summary.policy).toBe("cap-size");
    expect(guard.summary.lowerBoundUsd).toBeLessThan(0);
    expect(guard.summary.recommendedSizeBtc).toBeGreaterThan(0);
    expect(guard.summary.recommendedSizeBtc).toBeLessThan(0.4);
    expect(guard.reasons.join(" ")).toContain("capital at risk");
  });
});

function replay(netProfits: number[]): HistoricalReplay {
  const trades = netProfits.map((netProfitUsd, index) => trade(netProfitUsd, index));
  return {
    generatedAt: 1,
    candles: { kraken: trades.length, coinbase: trades.length, aligned: trades.length },
    trades,
    validationTrades: trades.slice(Math.floor(trades.length / 2)),
    equityCurve: trades.map((item, index) => ({
      timestamp: item.timestamp,
      cumulativePnlUsd: trades.slice(0, index + 1).reduce((sum, trade) => sum + trade.netProfitUsd, 0),
    })),
    summary: {
      totalPnlUsd: trades.reduce((sum, item) => sum + item.netProfitUsd, 0),
      tradeCount: trades.length,
      winRate: 1,
      maxDrawdownUsd: 0,
      averageSpreadBps: 20,
      bestTradeUsd: Math.max(...netProfits),
      worstTradeUsd: Math.min(...netProfits),
    },
    strategies: [],
    sensitivity: { minSpreadBpsValues: [], costBpsValues: [], cells: [] },
    statArb: {
      sampleCount: trades.length,
      returnCorrelation: 0.9,
      spreadMeanBps: 12,
      spreadStdBps: 3,
      latestSpreadBps: 13,
      latestZScore: 0.3,
      leadLag: [{ lagMinutes: 0, correlation: 0.9 }],
      bestLeadLag: { lagMinutes: 0, correlation: 0.9 },
      regime: "mean-reverting",
      thesis: "fixture",
    },
    sources: ["kraken", "coinbase"],
    errors: [],
  };
}

function trade(netProfitUsd: number, index: number): HistoricalTrade {
  return {
    timestamp: (index + 1) * 60_000,
    buyVenue: index % 2 === 0 ? "kraken" : "coinbase",
    sellVenue: index % 2 === 0 ? "coinbase" : "kraken",
    buyPrice: 70_000,
    sellPrice: 70_120,
    sizeBtc: 0.25,
    grossProfitUsd: netProfitUsd + 9,
    netProfitUsd,
    spreadBps: 17 + index,
    reason: "fixture",
  };
}

function decision(input: { netProfitUsd: number; tradeSizeBtc: number }): OpportunityDecision {
  return {
    id: "decision-1",
    status: "accepted",
    buyExchange: "kraken",
    sellExchange: "coinbase",
    quoteAsset: "USD",
    observedAt: 1,
    tradeSizeBtc: input.tradeSizeBtc,
    grossProfitUsd: input.netProfitUsd + 12,
    netProfitUsd: input.netProfitUsd,
    buyFill: { filledBtc: input.tradeSizeBtc, notional: 70_000 * input.tradeSizeBtc, vwap: 70_000, complete: true, levelsUsed: [] },
    sellFill: { filledBtc: input.tradeSizeBtc, notional: 70_120 * input.tradeSizeBtc, vwap: 70_120, complete: true, levelsUsed: [] },
    rejectionReasons: [],
    risk: {
      score: 82,
      latencyPenaltyUsd: 2,
      feeCostUsd: 8,
      withdrawalCostUsd: 2,
      grossProfitUsd: input.netProfitUsd + 12,
      positivePnlProbability: 0.74,
      reasons: [],
    },
    impactCurve: [],
    microstructure: {
      buy: { midPrice: 70_000, spreadUsd: 2, spreadBps: 0.3, imbalance: 0.1, microprice: 70_001, pressure: "bid" },
      sell: { midPrice: 70_120, spreadUsd: 2, spreadBps: 0.3, imbalance: 0.1, microprice: 70_121, pressure: "bid" },
    },
    explanation: "fixture",
  };
}

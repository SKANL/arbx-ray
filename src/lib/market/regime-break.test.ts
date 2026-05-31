import { describe, expect, it } from "vitest";
import { buildBayesianRegimeBreakLab } from "./regime-break";
import type { HistoricalReplay, HistoricalTrade } from "./historical";

function trade(index: number, spreadBps: number, netProfitUsd = 18): HistoricalTrade {
  return {
    timestamp: 1_780_000_000_000 + index * 60_000,
    buyVenue: "kraken",
    sellVenue: "coinbase",
    buyPrice: 70_000,
    sellPrice: 70_000 * (1 + spreadBps / 10_000),
    sizeBtc: 0.25,
    grossProfitUsd: spreadBps * 1.75,
    netProfitUsd,
    spreadBps,
    reason: "fixture",
  };
}

function replay(spreads: number[]): HistoricalReplay {
  const trades = spreads.map((spread, index) => trade(index, spread, spread > 0 ? 20 : -12));
  return {
    generatedAt: 1_780_000_000_000,
    candles: { kraken: spreads.length, coinbase: spreads.length, aligned: spreads.length },
    trades,
    equityCurve: trades.map((item, index) => ({
      timestamp: item.timestamp,
      cumulativePnlUsd: trades.slice(0, index + 1).reduce((sum, tradeItem) => sum + tradeItem.netProfitUsd, 0),
    })),
    summary: {
      totalPnlUsd: trades.reduce((sum, item) => sum + item.netProfitUsd, 0),
      tradeCount: trades.length,
      winRate: trades.filter((item) => item.netProfitUsd > 0).length / trades.length,
      maxDrawdownUsd: 0,
      averageSpreadBps: spreads.reduce((sum, item) => sum + item, 0) / spreads.length,
      bestTradeUsd: 20,
      worstTradeUsd: -12,
    },
    strategies: [],
    sensitivity: { minSpreadBpsValues: [], costBpsValues: [], cells: [] },
    statArb: {
      sampleCount: spreads.length,
      returnCorrelation: 0.96,
      spreadMeanBps: 0,
      spreadStdBps: 1,
      latestSpreadBps: spreads[spreads.length - 1] ?? 0,
      latestZScore: 0,
      leadLag: [{ lagMinutes: 0, correlation: 0.96 }],
      bestLeadLag: { lagMinutes: 0, correlation: 0.96 },
      regime: "mean-reverting",
      thesis: "fixture",
    },
    sources: ["kraken-candles", "coinbase-candles"],
    errors: [],
  };
}

describe("buildBayesianRegimeBreakLab", () => {
  it("flags a structural break when profitable historical spread flips negative", () => {
    const lab = buildBayesianRegimeBreakLab({
      replay: replay([
        12, 11, 13, 12, 11, 12, 13, 12, 11, 12,
        -9, -11, -10, -12, -11, -13,
      ]),
      hazardRate: 0.08,
    });

    expect(lab.summary.policy).toBe("retrain");
    expect(lab.summary.latestBreakProbability).toBeGreaterThan(0.55);
    expect(lab.summary.regimeShiftBps).toBeLessThan(-18);
    expect(lab.summary.expectedEdgeDecayBps).toBeGreaterThan(15);
    expect(lab.changepoints[0]?.timestamp).toBe(1_780_000_000_000 + 10 * 60_000);
    expect(lab.equation).toContain("P(change_t | x_1:t)");
  });

  it("trusts history when spread distribution stays stable", () => {
    const lab = buildBayesianRegimeBreakLab({
      replay: replay([10, 11, 9, 10, 12, 11, 10, 9, 11, 10, 12, 10, 11, 9, 10, 11]),
      hazardRate: 0.05,
    });

    expect(lab.summary.policy).toBe("trust-history");
    expect(lab.summary.latestBreakProbability).toBeLessThan(0.25);
    expect(lab.summary.expectedEdgeDecayBps).toBeLessThan(4);
    expect(lab.changepoints).toHaveLength(0);
  });

  it("requires enough historical trades before making regime claims", () => {
    const lab = buildBayesianRegimeBreakLab({ replay: replay([8, 9, 10]) });

    expect(lab.summary.policy).toBe("insufficient-history");
    expect(lab.observations).toHaveLength(0);
    expect(lab.reasons).toContain("Need at least 8 historical simulated trades for Bayesian change-point evidence.");
  });
});

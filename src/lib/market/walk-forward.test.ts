import { describe, expect, it } from "vitest";
import { buildWalkForwardRobustness } from "./walk-forward";
import type { HistoricalReplay, HistoricalTrade } from "./historical";

describe("buildWalkForwardRobustness", () => {
  it("selects a trained spread filter and deploys when out-of-sample results generalize", () => {
    const lab = buildWalkForwardRobustness(replay([
      trade(1, 9, 18),
      trade(2, 11, 24),
      trade(3, 14, 31),
      trade(4, 18, 44),
      trade(5, 21, 49),
      trade(6, 13, 29),
      trade(7, 15, 28),
      trade(8, 19, 43),
      trade(9, 22, 47),
      trade(10, 16, 34),
    ]));

    expect(lab.summary.policy).toBe("deploy");
    expect(lab.summary.selectedMinSpreadBps).toBeGreaterThanOrEqual(8);
    expect(lab.summary.outOfSamplePnlUsd).toBeGreaterThan(0);
    expect(lab.summary.generalizationRatio).toBeGreaterThan(0.65);
    expect(lab.equation).toContain("generalization_ratio");
  });

  it("rejects an overfit filter when train performance does not survive the test window", () => {
    const lab = buildWalkForwardRobustness(replay([
      trade(1, 24, 80),
      trade(2, 26, 92),
      trade(3, 29, 110),
      trade(4, 31, 120),
      trade(5, 28, 98),
      trade(6, 25, 86),
      trade(7, 26, -58),
      trade(8, 29, -82),
      trade(9, 31, -95),
      trade(10, 27, -70),
    ]));

    expect(lab.summary.policy).toBe("reject-overfit");
    expect(lab.summary.outOfSamplePnlUsd).toBeLessThan(0);
    expect(lab.summary.overfitPenalty).toBeGreaterThan(50);
    expect(lab.candidates[0]?.testScore).toBeLessThan(lab.candidates[0]?.trainScore ?? 0);
    expect(lab.reasons.join(" ")).toContain("out-of-sample");
  });

  it("falls back to strategy sample trades when the base replay has a quiet trade window", () => {
    const base = replay([trade(1, 9, 18)]);
    const lab = buildWalkForwardRobustness({
      ...base,
      strategies: [
        {
          id: "aggressive",
          label: "Aggressive",
          thesis: "fixture",
          config: { sizeBtc: 0.25, feeBps: 12, slippageBps: 3, latencyBps: 2, envelopeUncertaintyBps: 4, minSpreadBps: 4 },
          summary: { ...base.summary, riskAdjustedScore: 80, profitFactor: 10, tradesPerHour: 4 },
          equityCurve: [],
          sampleTrades: [
            trade(2, 11, 24),
            trade(3, 14, 31),
            trade(4, 18, 44),
            trade(5, 21, 49),
            trade(6, 13, 29),
          ],
        },
      ],
    });

    expect(lab.summary.policy).not.toBe("insufficient-history");
    expect(lab.trainWindow.tradeCount + lab.testWindow.tradeCount).toBeGreaterThanOrEqual(6);
  });
});

function replay(trades: HistoricalTrade[]): HistoricalReplay {
  return {
    generatedAt: 1_700_000_000_000,
    candles: { kraken: 120, coinbase: 120, aligned: 120 },
    trades,
    equityCurve: [],
    summary: {
      totalPnlUsd: trades.reduce((sum, item) => sum + item.netProfitUsd, 0),
      tradeCount: trades.length,
      winRate: trades.filter((item) => item.netProfitUsd > 0).length / trades.length,
      maxDrawdownUsd: 0,
      averageSpreadBps: trades.reduce((sum, item) => sum + item.spreadBps, 0) / trades.length,
      bestTradeUsd: Math.max(...trades.map((item) => item.netProfitUsd)),
      worstTradeUsd: Math.min(...trades.map((item) => item.netProfitUsd)),
    },
    strategies: [],
    sensitivity: { minSpreadBpsValues: [], costBpsValues: [], cells: [] },
    statArb: {
      sampleCount: 120,
      returnCorrelation: 0.98,
      spreadMeanBps: 10,
      spreadStdBps: 3,
      latestSpreadBps: 11,
      latestZScore: 0.3,
      leadLag: [{ lagMinutes: 0, correlation: 0.98 }],
      bestLeadLag: { lagMinutes: 0, correlation: 0.98 },
      regime: "mean-reverting",
      thesis: "test",
    },
    sources: ["kraken", "coinbase"],
    errors: [],
  };
}

function trade(index: number, spreadBps: number, netProfitUsd: number): HistoricalTrade {
  return {
    timestamp: index * 60_000,
    buyVenue: index % 2 === 0 ? "coinbase" : "kraken",
    sellVenue: index % 2 === 0 ? "kraken" : "coinbase",
    buyPrice: 70_000,
    sellPrice: 70_000 * (1 + spreadBps / 10_000),
    sizeBtc: 0.25,
    grossProfitUsd: netProfitUsd + 12,
    netProfitUsd,
    spreadBps,
    reason: "fixture",
  };
}

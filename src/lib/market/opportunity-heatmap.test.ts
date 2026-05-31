import { describe, expect, it } from "vitest";
import { buildOpportunityHeatmap } from "./opportunity-heatmap";
import type { HistoricalReplay, HistoricalTrade } from "./historical";

describe("buildOpportunityHeatmap", () => {
  it("buckets historical trades by hour and edge tier with concentration score", () => {
    const heatmap = buildOpportunityHeatmap({
      replay: replay([
        trade("2026-05-29T08:01:00Z", 6, 3),
        trade("2026-05-29T08:12:00Z", 14, 9),
        trade("2026-05-29T08:44:00Z", 29, 21),
        trade("2026-05-29T08:52:00Z", 45, 39),
        trade("2026-05-29T08:58:00Z", 48, 42),
        trade("2026-05-29T09:02:00Z", 20, 17),
        trade("2026-05-29T09:18:00Z", 22, 19),
        trade("2026-05-29T12:10:00Z", 52, 48),
      ]),
    });

    expect(heatmap.cells.length).toBeGreaterThan(0);
    expect(heatmap.summary.hotHourUtc).toBe(8);
    expect(heatmap.summary.hotTier).toBe("elite");
    expect(heatmap.summary.opportunityCount).toBe(8);
    expect(heatmap.summary.concentrationScore).toBeGreaterThan(40);
    expect(heatmap.cells.find((cell) => cell.hourUtc === 8 && cell.edgeTier === "strong")?.tradeCount).toBe(1);
    expect(heatmap.equation).toContain("opportunity_density");
  });

  it("returns an empty standby heatmap when no historical opportunities exist", () => {
    const heatmap = buildOpportunityHeatmap({ replay: replay([]) });

    expect(heatmap.summary.opportunityCount).toBe(0);
    expect(heatmap.summary.policy).toBe("insufficient-history");
    expect(heatmap.cells.every((cell) => cell.tradeCount === 0)).toBe(true);
  });
});

function replay(trades: HistoricalTrade[]): HistoricalReplay {
  return {
    generatedAt: 1_700_000_000_000,
    candles: { kraken: 100, coinbase: 100, aligned: 100 },
    trades,
    equityCurve: trades.map((item, index) => ({
      timestamp: item.timestamp,
      cumulativePnlUsd: trades.slice(0, index + 1).reduce((sum, trade) => sum + trade.netProfitUsd, 0),
    })),
    summary: {
      totalPnlUsd: trades.reduce((sum, item) => sum + item.netProfitUsd, 0),
      tradeCount: trades.length,
      winRate: trades.length ? 1 : 0,
      maxDrawdownUsd: 0,
      averageSpreadBps: trades.length ? trades.reduce((sum, item) => sum + item.spreadBps, 0) / trades.length : 0,
      bestTradeUsd: Math.max(0, ...trades.map((item) => item.netProfitUsd)),
      worstTradeUsd: Math.min(0, ...trades.map((item) => item.netProfitUsd)),
    },
    strategies: [],
    sensitivity: { minSpreadBpsValues: [], costBpsValues: [], cells: [] },
    statArb: {
      sampleCount: 0,
      returnCorrelation: 0,
      spreadMeanBps: 0,
      spreadStdBps: 0,
      latestSpreadBps: 0,
      latestZScore: 0,
      leadLag: [],
      bestLeadLag: { lagMinutes: 0, correlation: 0 },
      regime: "insufficient-data",
      thesis: "fixture",
    },
    sources: ["fixture"],
    errors: [],
  };
}

function trade(iso: string, spreadBps: number, netProfitUsd: number): HistoricalTrade {
  return {
    timestamp: Date.parse(iso),
    buyVenue: "kraken",
    sellVenue: "coinbase",
    buyPrice: 73_000,
    sellPrice: 73_000 * (1 + spreadBps / 10_000),
    sizeBtc: 0.25,
    grossProfitUsd: netProfitUsd + 5,
    netProfitUsd,
    spreadBps,
    reason: "fixture",
  };
}

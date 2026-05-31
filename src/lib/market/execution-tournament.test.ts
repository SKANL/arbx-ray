import { describe, expect, it } from "vitest";
import { buildExecutionTournament } from "./execution-tournament";
import type { HistoricalReplay, HistoricalStrategyRun, HistoricalTrade } from "./historical";
import type { SequentialExecutionTest } from "./sequential-execution-test";
import type { WalkForwardRobustness } from "./walk-forward";

describe("buildExecutionTournament", () => {
  it("promotes ArbX-Ray autopilot when walk-forward evidence beats naive spread chasing on regret", () => {
    const tournament = buildExecutionTournament({
      replay: replayFixture(),
      walkForwardRobustness: walkForward("deploy", 0.82, 138),
      sequentialExecutionTest: sequential("accept-execute", 3.4),
    });

    expect(tournament.summary.policy).toBe("ship-autopilot");
    expect(tournament.summary.championId).toBe("arbx-ray-autopilot");
    expect(tournament.summary.arbxRank).toBe(1);
    expect(tournament.contestants.find((item) => item.id === "naive-spread-chaser")?.regretUsd).toBeGreaterThan(
      tournament.summary.arbxRegretUsd,
    );
    expect(tournament.equation).toContain("regret");
  });

  it("marks autopilot for cap and monitor when the live execution gate rejects current conditions", () => {
    const tournament = buildExecutionTournament({
      replay: replayFixture(),
      walkForwardRobustness: walkForward("deploy", 0.82, 138),
      sequentialExecutionTest: sequential("reject-execution", -4.1),
      liveDecisionAvailable: true,
    });

    const autopilot = tournament.contestants.find((item) => item.id === "arbx-ray-autopilot");

    expect(tournament.summary.policy).toBe("cap-and-monitor");
    expect(autopilot?.action).toBe("cap-size");
    expect(autopilot?.evidence.join(" ")).toContain("live SPRT gate rejected");
    expect(tournament.summary.arbxRank).toBeGreaterThan(1);
  });

  it("returns insufficient history when no real replay strategies are loaded", () => {
    const tournament = buildExecutionTournament();

    expect(tournament.summary.policy).toBe("insufficient-history");
    expect(tournament.contestants).toHaveLength(0);
    expect(tournament.reasons.join(" ")).toContain("historical replay");
  });
});

function replayFixture(): HistoricalReplay {
  const conservativeTrades = trades([42, 38, 31], 12);
  const balancedTrades = trades([62, 54, 48, 31], 8);
  const aggressiveTrades = trades([74, -42, 70, -36, 68, 28], 4);
  const validationTrades = trades([51, 44, 43], 10);
  const strategies: HistoricalStrategyRun[] = [
    strategy("conservative", "Conservative", 74, conservativeTrades),
    strategy("balanced", "Balanced", 82, balancedTrades),
    strategy("aggressive", "Aggressive", 54, aggressiveTrades),
  ];

  return {
    generatedAt: 1_780_000_000_000,
    candles: { kraken: 12, coinbase: 12, aligned: 12 },
    trades: balancedTrades,
    equityCurve: equity(balancedTrades),
    summary: summary(balancedTrades),
    validationTrades,
    strategies,
    sensitivity: { minSpreadBpsValues: [], costBpsValues: [], cells: [] },
    statArb: {
      sampleCount: 12,
      returnCorrelation: 0.91,
      spreadMeanBps: 9,
      spreadStdBps: 3,
      latestSpreadBps: 13,
      latestZScore: 1.1,
      leadLag: [{ lagMinutes: 0, correlation: 0.91 }],
      bestLeadLag: { lagMinutes: 0, correlation: 0.91 },
      regime: "mean-reverting",
      thesis: "fixture",
    },
    sources: ["kraken-ohlc", "coinbase-candles"],
    errors: [],
  };
}

function strategy(
  id: HistoricalStrategyRun["id"],
  label: string,
  riskAdjustedScore: number,
  sampleTrades: HistoricalTrade[],
): HistoricalStrategyRun {
  return {
    id,
    label,
    thesis: `${label} fixture`,
    config: {
      sizeBtc: id === "aggressive" ? 0.35 : id === "conservative" ? 0.15 : 0.25,
      feeBps: 16,
      slippageBps: 4,
      latencyBps: 3,
      envelopeUncertaintyBps: 8,
      minSpreadBps: id === "aggressive" ? 4 : id === "conservative" ? 18 : 8,
    },
    summary: {
      ...summary(sampleTrades),
      riskAdjustedScore,
      profitFactor: 3.2,
      tradesPerHour: sampleTrades.length / 2,
    },
    equityCurve: equity(sampleTrades),
    sampleTrades,
  };
}

function walkForward(
  policy: WalkForwardRobustness["summary"]["policy"],
  generalizationRatio: number,
  outOfSamplePnlUsd: number,
): WalkForwardRobustness {
  return {
    generatedAt: 1_780_000_000_000,
    trainWindow: { tradeCount: 8 },
    testWindow: { tradeCount: 4 },
    candidates: [],
    summary: {
      policy,
      selectedMinSpreadBps: 12,
      trainScore: 84,
      testScore: Math.round(84 * generalizationRatio),
      generalizationRatio,
      outOfSamplePnlUsd,
      outOfSampleWinRate: 0.78,
      overfitPenalty: 12,
    },
    reasons: ["fixture"],
    equation: "fixture",
  };
}

function sequential(
  decision: SequentialExecutionTest["summary"]["decision"],
  finalLogLikelihood: number,
): SequentialExecutionTest {
  return {
    generatedAt: 1_780_000_000_000,
    alpha: 0.08,
    beta: 0.12,
    upperBoundary: 2.39,
    lowerBoundary: -2.04,
    steps: [],
    summary: {
      decision,
      finalLogLikelihood,
      confidencePct: 92,
      falseExecuteRiskPct: 8,
      falseRejectRiskPct: 12,
      evidenceCount: 6,
    },
    reasons: ["fixture"],
    equation: "fixture",
  };
}

function trades(pnls: number[], spreadBps: number): HistoricalTrade[] {
  return pnls.map((netProfitUsd, index) => ({
    timestamp: 1_780_000_000_000 + index * 60_000,
    buyVenue: index % 2 === 0 ? "kraken" : "coinbase",
    sellVenue: index % 2 === 0 ? "coinbase" : "kraken",
    buyPrice: 70_000,
    sellPrice: 70_000 + spreadBps * 7,
    sizeBtc: 0.25,
    grossProfitUsd: netProfitUsd + 22,
    netProfitUsd,
    spreadBps,
    reason: "fixture",
  }));
}

function equity(tradesInput: HistoricalTrade[]): { timestamp: number; cumulativePnlUsd: number }[] {
  let cumulativePnlUsd = 0;
  return tradesInput.map((trade) => {
    cumulativePnlUsd += trade.netProfitUsd;
    return { timestamp: trade.timestamp, cumulativePnlUsd };
  });
}

function summary(tradesInput: HistoricalTrade[]): HistoricalReplay["summary"] {
  const curve = equity(tradesInput);
  let peak = 0;
  let maxDrawdownUsd = 0;
  for (const point of curve) {
    peak = Math.max(peak, point.cumulativePnlUsd);
    maxDrawdownUsd = Math.max(maxDrawdownUsd, peak - point.cumulativePnlUsd);
  }
  return {
    totalPnlUsd: tradesInput.reduce((sum, trade) => sum + trade.netProfitUsd, 0),
    tradeCount: tradesInput.length,
    winRate: tradesInput.filter((trade) => trade.netProfitUsd > 0).length / tradesInput.length,
    maxDrawdownUsd,
    averageSpreadBps: tradesInput.reduce((sum, trade) => sum + trade.spreadBps, 0) / tradesInput.length,
    bestTradeUsd: Math.max(...tradesInput.map((trade) => trade.netProfitUsd)),
    worstTradeUsd: Math.min(...tradesInput.map((trade) => trade.netProfitUsd)),
  };
}

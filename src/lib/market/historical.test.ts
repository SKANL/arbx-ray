import { describe, expect, it } from "vitest";
import {
  buildHistoricalReplay,
  buildSensitivitySurface,
  buildStatArbSignal,
  buildStrategyRuns,
  parseCoinbaseCandles,
  parseKrakenOhlcCandles,
} from "./historical";

describe("historical candle parsers", () => {
  it("normalizes Kraken and Coinbase public OHLC shapes", () => {
    const kraken = parseKrakenOhlcCandles({
      result: {
        XXBTZUSD: [[1000, "100", "102", "99", "101", "100.5", "12", 20]],
        last: 1000,
      },
    });
    const coinbase = parseCoinbaseCandles([[1000, 100, 103, 101, 102, 8]]);

    expect(kraken[0]).toMatchObject({ venue: "kraken", close: 101, volumeBtc: 12 });
    expect(coinbase[0]).toMatchObject({ venue: "coinbase", open: 101, close: 102 });
  });
});

describe("buildHistoricalReplay", () => {
  it("aligns venue candles and simulates historical arbitrage trades net of costs", () => {
    const replay = buildHistoricalReplay({
      kraken: [
        { venue: "kraken", timestamp: 60_000, open: 100, high: 101, low: 99, close: 100, volumeBtc: 10 },
        { venue: "kraken", timestamp: 120_000, open: 100, high: 101, low: 99, close: 105, volumeBtc: 10 },
      ],
      coinbase: [
        { venue: "coinbase", timestamp: 60_000, open: 100, high: 103, low: 99, close: 102, volumeBtc: 8 },
        { venue: "coinbase", timestamp: 120_000, open: 100, high: 101, low: 98, close: 100, volumeBtc: 8 },
      ],
      config: { sizeBtc: 1, minSpreadBps: 10, feeBps: 10, slippageBps: 0, latencyBps: 0 },
    });

    expect(replay.candles.aligned).toBe(2);
    expect(replay.trades).toHaveLength(2);
    expect(replay.trades[0]?.buyVenue).toBe("kraken");
    expect(replay.trades[1]?.buyVenue).toBe("coinbase");
    expect(replay.summary.tradeCount).toBe(2);
    expect(replay.summary.totalPnlUsd).toBeGreaterThan(0);
    expect(replay.strategies).toHaveLength(3);
    expect(replay.strategies.map((strategy) => strategy.id)).toEqual([
      "conservative",
      "balanced",
      "aggressive",
    ]);
    expect(replay.sensitivity.cells.length).toBeGreaterThan(0);
    expect(replay.sensitivity.bestCell).toBeDefined();
    expect(replay.statArb.sampleCount).toBe(2);
  });

  it("uses candle envelope candidates with an uncertainty penalty when close spreads are quiet", () => {
    const replay = buildHistoricalReplay({
      kraken: [
        { venue: "kraken", timestamp: 60_000, open: 100, high: 101, low: 96, close: 100, volumeBtc: 10 },
      ],
      coinbase: [
        { venue: "coinbase", timestamp: 60_000, open: 100, high: 104, low: 99, close: 100.02, volumeBtc: 8 },
      ],
      config: {
        sizeBtc: 1,
        minSpreadBps: 10,
        feeBps: 10,
        slippageBps: 0,
        latencyBps: 0,
        envelopeUncertaintyBps: 20,
      },
    });

    expect(replay.trades).toHaveLength(1);
    expect(replay.trades[0]?.reason).toContain("candle envelope");
    expect(replay.trades[0]?.netProfitUsd).toBeGreaterThan(0);
  });
});

describe("buildSensitivitySurface", () => {
  it("sweeps spread thresholds and cost assumptions over the same aligned candles", () => {
    const alignedCandles = [
      {
        kraken: { venue: "kraken" as const, timestamp: 60_000, open: 100, high: 101, low: 96, close: 100, volumeBtc: 10 },
        coinbase: { venue: "coinbase" as const, timestamp: 60_000, open: 100, high: 104, low: 99, close: 100, volumeBtc: 8 },
      },
      {
        kraken: { venue: "kraken" as const, timestamp: 120_000, open: 100, high: 101, low: 97, close: 100, volumeBtc: 10 },
        coinbase: { venue: "coinbase" as const, timestamp: 120_000, open: 100, high: 103, low: 99, close: 100, volumeBtc: 8 },
      },
    ];

    const surface = buildSensitivitySurface(alignedCandles);

    expect(surface.cells).toHaveLength(surface.minSpreadBpsValues.length * surface.costBpsValues.length);
    expect(surface.bestCell?.riskAdjustedScore).toBeGreaterThanOrEqual(0);
    const lowCostCell = surface.cells.find((cell) => cell.minSpreadBps === 4 && cell.costBps === 16);
    const highCostCell = surface.cells.find((cell) => cell.minSpreadBps === 4 && cell.costBps === 60);
    expect(lowCostCell?.totalPnlUsd ?? 0).toBeGreaterThanOrEqual(highCostCell?.totalPnlUsd ?? 0);
  });
});

describe("buildStatArbSignal", () => {
  it("estimates correlation, spread z-score, lead-lag, and half-life from aligned candles", () => {
    const alignedCandles = Array.from({ length: 12 }, (_, index) => {
      const base = 100 + index;
      const spread = base * 0.001 + Math.sin(index / 2) * 0.02;
      return {
        kraken: { venue: "kraken" as const, timestamp: (index + 1) * 60_000, open: base, high: base + 1, low: base - 1, close: base, volumeBtc: 10 },
        coinbase: { venue: "coinbase" as const, timestamp: (index + 1) * 60_000, open: base + spread, high: base + 1, low: base - 1, close: base + spread, volumeBtc: 8 },
      };
    });

    const signal = buildStatArbSignal(alignedCandles);

    expect(signal.sampleCount).toBe(12);
    expect(signal.returnCorrelation).toBeGreaterThan(0.9);
    expect(signal.leadLag).toHaveLength(7);
    expect(signal.bestLeadLag).toBeDefined();
    expect(signal.spreadStdBps).toBeGreaterThan(0);
    expect(["mean-reverting", "breakout-risk", "insufficient-data"]).toContain(signal.regime);
  });
});

describe("buildStrategyRuns", () => {
  it("compares risk profiles with different thresholds, sizes, and uncertainty penalties", () => {
    const alignedCandles = [
      {
        kraken: { venue: "kraken" as const, timestamp: 60_000, open: 100, high: 101, low: 96, close: 100, volumeBtc: 10 },
        coinbase: { venue: "coinbase" as const, timestamp: 60_000, open: 100, high: 104, low: 99, close: 100, volumeBtc: 8 },
      },
      {
        kraken: { venue: "kraken" as const, timestamp: 120_000, open: 100, high: 101, low: 97, close: 100, volumeBtc: 10 },
        coinbase: { venue: "coinbase" as const, timestamp: 120_000, open: 100, high: 103, low: 99, close: 100, volumeBtc: 8 },
      },
    ];

    const runs = buildStrategyRuns(alignedCandles);
    const conservative = runs.find((run) => run.id === "conservative");
    const aggressive = runs.find((run) => run.id === "aggressive");

    expect(conservative?.config.minSpreadBps).toBeGreaterThan(aggressive?.config.minSpreadBps ?? 0);
    expect(aggressive?.config.sizeBtc).toBeGreaterThan(conservative?.config.sizeBtc ?? 0);
    expect(runs.every((run) => run.summary.riskAdjustedScore >= 0)).toBe(true);
  });
});

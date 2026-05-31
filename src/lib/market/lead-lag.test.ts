import { describe, expect, it } from "vitest";
import {
  buildLeadLagOracle,
  parseBitfinexLeadLagTrades,
  parseBitstampLeadLagTrades,
  parseCoinbaseLeadLagTrades,
  parseGeminiLeadLagTrades,
  parseKrakenLeadLagTrades,
  type LeadLagTrade,
} from "./lead-lag";

const base = Date.UTC(2026, 4, 29, 12, 0, 0);

describe("lead-lag trade parsers", () => {
  it("normalizes public trade payloads from major venues", () => {
    const coinbase = parseCoinbaseLeadLagTrades([
      { trade_id: 1, price: "100000", size: "0.1", time: new Date(base).toISOString(), side: "sell" },
    ]);
    const kraken = parseKrakenLeadLagTrades({
      result: {
        XXBTZUSD: [["100010", "0.2", String(base / 1000), "b", "m", "", "99"]],
        last: "ignored",
      },
    });
    const bitstamp = parseBitstampLeadLagTrades([
      { tid: 7, price: "100020", amount: "0.3", date: String(base / 1000), type: "1" },
    ]);
    const gemini = parseGeminiLeadLagTrades([
      { tid: 8, price: "100030", amount: "0.4", timestampms: base, type: "buy" },
    ]);
    const bitfinex = parseBitfinexLeadLagTrades([[9, base, -0.5, 100040]]);

    expect(coinbase[0]).toMatchObject({ venue: "coinbase", side: "buy", sizeBtc: 0.1 });
    expect(kraken[0]).toMatchObject({ venue: "kraken", side: "buy", sizeBtc: 0.2 });
    expect(bitstamp[0]).toMatchObject({ venue: "bitstamp", side: "sell", sizeBtc: 0.3 });
    expect(gemini[0]).toMatchObject({ venue: "gemini", side: "buy", sizeBtc: 0.4 });
    expect(bitfinex[0]).toMatchObject({ venue: "bitfinex", side: "sell", sizeBtc: 0.5 });
  });
});

describe("buildLeadLagOracle", () => {
  it("detects a venue that leads another venue by one time bucket", () => {
    const coinbase = series("coinbase", [100_000, 100_100, 100_240, 100_190, 100_310, 100_420]);
    const kraken = series("kraken", [99_980, 99_980, 100_080, 100_220, 100_170, 100_290]);

    const oracle = buildLeadLagOracle({
      tradesByVenue: { coinbase, kraken },
      observedAt: base + 6 * 10_000,
      bucketMs: 10_000,
    });

    expect(oracle.summary.policy).toBe("follow-leader");
    expect(oracle.summary.leaderVenue).toBe("coinbase");
    expect(oracle.pairs[0]).toMatchObject({ leader: "coinbase", follower: "kraken", lagBuckets: 1 });
    expect(oracle.summary.predictedDriftBps).toBeGreaterThan(0);
    expect(oracle.equation).toContain("corr");
  });

  it("waits when public trade data is too sparse for lag inference", () => {
    const oracle = buildLeadLagOracle({
      tradesByVenue: { coinbase: series("coinbase", [100_000, 100_010]) },
      observedAt: base + 30_000,
      bucketMs: 10_000,
    });

    expect(oracle.summary.policy).toBe("wait");
    expect(oracle.summary.confidence).toBe("low");
    expect(oracle.pairs).toHaveLength(0);
  });
});

function series(venue: LeadLagTrade["venue"], prices: number[]): LeadLagTrade[] {
  return prices.map((price, index) => ({
    venue,
    symbol: venue === "kraken" ? "BTC/USD" : "BTC-USD",
    quoteAsset: "USD",
    tradeId: `${venue}-${index}`,
    price,
    sizeBtc: 0.05 + index * 0.005,
    notionalUsd: price * (0.05 + index * 0.005),
    timestamp: base + index * 10_000 + 500,
    receivedAt: base + prices.length * 10_000,
    side: index === 0 || prices[index] >= prices[index - 1] ? "buy" : "sell",
  }));
}

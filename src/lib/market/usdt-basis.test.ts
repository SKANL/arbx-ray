import { describe, expect, it } from "vitest";
import {
  buildUsdtBasisOracle,
  parseBitstampUsdtTicker,
  parseCoinbaseUsdtTicker,
  parseCoinGeckoTetherPrice,
  parseKrakenUsdtTicker,
} from "./usdt-basis";

describe("USDT basis parsers", () => {
  it("normalizes public USDT/USD sources into USD prices", () => {
    expect(parseCoinbaseUsdtTicker({ price: "0.9991", bid: "0.9990", ask: "0.9992", volume: "1000" }, 1000)).toMatchObject({
      venue: "coinbase",
      priceUsd: 0.9991,
      bidUsd: 0.999,
      askUsd: 0.9992,
    });

    expect(parseKrakenUsdtTicker({ result: { USDTZUSD: { c: ["0.9989"], b: ["0.9988"], a: ["0.9990"], v: ["10", "20"] } } }, 1000)).toMatchObject({
      venue: "kraken",
      priceUsd: 0.9989,
      volumeUsd: 20 * 0.9989,
    });

    expect(parseBitstampUsdtTicker({ last: "1.0002", bid: "1.0001", ask: "1.0003", volume: "500", timestamp: "1780000000" }, 1000)).toMatchObject({
      venue: "bitstamp",
      priceUsd: 1.0002,
      exchangeTimestamp: 1_780_000_000_000,
    });

    expect(parseCoinGeckoTetherPrice({ tether: { usd: 0.9995, usd_24h_vol: 1_000_000, last_updated_at: 1780000000 } }, 1000)).toMatchObject({
      venue: "coingecko",
      priceUsd: 0.9995,
      volumeUsd: 1_000_000,
    });
  });
});

describe("buildUsdtBasisOracle", () => {
  it("converts median basis and dispersion into a dynamic cross-lane haircut", () => {
    const oracle = buildUsdtBasisOracle({
      tickers: [
        ticker("coinbase", 0.9987, 0.9986, 0.9988),
        ticker("kraken", 0.9986, 0.9985, 0.9987),
        ticker("bitstamp", 0.9988, 0.9987, 0.9989),
        ticker("coingecko", 0.99865),
      ],
      generatedAt: 2_000,
      staleMs: 30_000,
    });

    expect(oracle.medianUsdtUsd).toBeCloseTo(0.998675, 6);
    expect(oracle.summary.sourceCount).toBe(4);
    expect(oracle.summary.policy).toBe("haircut-required");
    expect(oracle.summary.dynamicHaircutBps).toBeGreaterThan(13);
    expect(oracle.explanation).toContain("haircut_bps");
  });

  it("halts cross-lane conversion when USDT depegs materially", () => {
    const oracle = buildUsdtBasisOracle({
      tickers: [
        ticker("coinbase", 0.991, 0.9908, 0.9912),
        ticker("kraken", 0.9908, 0.9907, 0.9910),
        ticker("bitstamp", 0.9911, 0.9909, 0.9913),
      ],
      generatedAt: 2_000,
      staleMs: 30_000,
    });

    expect(oracle.summary.policy).toBe("cross-lane-halt");
    expect(oracle.summary.dynamicHaircutBps).toBeGreaterThan(80);
    expect(oracle.venues.every((venue) => venue.state === "depeg")).toBe(true);
  });

  it("penalizes stale sources without treating them as price evidence", () => {
    const oracle = buildUsdtBasisOracle({
      tickers: [
        ticker("coinbase", 1.0001, 1.0000, 1.0002, -100_000),
        ticker("kraken", 1.0000),
        ticker("bitstamp", 0.9999),
      ],
      generatedAt: 1_000,
      staleMs: 30_000,
    });

    expect(oracle.venues.find((venue) => venue.venue === "coinbase")?.state).toBe("stale");
    expect(oracle.summary.staleCount).toBe(1);
    expect(oracle.summary.dynamicHaircutBps).toBeGreaterThanOrEqual(5);
  });
});

function ticker(venue: string, priceUsd: number, bidUsd?: number, askUsd?: number, receivedAt = 1_000) {
  return {
    venue,
    label: venue,
    pair: "USDT-USD",
    priceUsd,
    bidUsd,
    askUsd,
    receivedAt,
    source: `https://${venue}.example`,
  };
}

import { describe, expect, it } from "vitest";
import {
  buildPriceConsensusOracle,
  parseBinanceTicker,
  parseBitsoTicker,
  parseCoinbaseTicker,
  parseKrakenTicker,
} from "./price-consensus";

describe("price consensus parsers", () => {
  it("normalizes USD and USDT venue tickers", () => {
    expect(parseCoinbaseTicker({ price: "70010.5" }, 1000)?.priceUsd).toBe(70010.5);
    expect(parseBinanceTicker({ price: "70020.2" }, 1000)?.quoteAsset).toBe("USDT");
    expect(parseKrakenTicker({ result: { XXBTZUSD: { c: ["70030.3", "1"] } } }, 1000)?.venue).toBe("kraken");
  });

  it("converts Bitso BTC/MXN through executable USD/MXN midpoint", () => {
    const ticker = parseBitsoTicker(
      { success: true, payload: { book: "btc_mxn", last: "1260000", created_at: "2026-05-29T12:00:00.000+00:00" } },
      17.5,
      1000,
    );

    expect(ticker?.venue).toBe("bitso");
    expect(ticker?.quoteAsset).toBe("MXN");
    expect(ticker?.priceUsd).toBe(72000);
    expect(ticker?.fxRate).toBe(17.5);
  });
});

describe("buildPriceConsensusOracle", () => {
  it("uses median and MAD to flag outlier venues", () => {
    const oracle = buildPriceConsensusOracle({
      tickers: [
        ticker("coinbase", 70000),
        ticker("kraken", 70020),
        ticker("bitstamp", 69980),
        ticker("binance", 70010, "USDT"),
        ticker("bitso", 74200, "MXN"),
      ],
      generatedAt: 2000,
      staleMs: 30_000,
    });

    const bitso = oracle.venues.find((venue) => venue.venue === "bitso");
    expect(oracle.consensusPriceUsd).toBe(70010);
    expect(oracle.summary.outlierCount).toBe(1);
    expect(bitso?.state).toBe("outlier");
    expect(bitso?.premiumBps).toBeGreaterThan(500);
    expect(oracle.summary.confidence).toBe("medium");
  });

  it("penalizes stale sources even when price is near consensus", () => {
    const oracle = buildPriceConsensusOracle({
      tickers: [
        ticker("coinbase", 70000, "USD", 1_000),
        ticker("kraken", 70005, "USD", 1_000),
        ticker("bitstamp", 69995, "USD", 1_000),
        ticker("gemini", 70001, "USD", -100_000),
      ],
      generatedAt: 1000,
      staleMs: 30_000,
    });

    expect(oracle.venues.find((venue) => venue.venue === "gemini")?.state).toBe("stale");
    expect(oracle.summary.staleCount).toBe(1);
  });
});

function ticker(venue: string, priceUsd: number, quoteAsset: "USD" | "USDT" | "MXN" = "USD", receivedAt = 1000) {
  return {
    venue,
    label: venue,
    pair: quoteAsset === "USDT" ? "BTC-USDT" : quoteAsset === "MXN" ? "btc_mxn" : "BTC-USD",
    quoteAsset,
    priceUsd,
    rawPrice: priceUsd,
    receivedAt,
    source: `https://${venue}.example`,
  };
}

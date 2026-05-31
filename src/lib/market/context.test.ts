import { describe, expect, it } from "vitest";
import { buildMarketContext, parseBinanceKlines, parseKrakenOhlc } from "./context";

describe("parseBinanceKlines", () => {
  it("extracts close prices from Binance kline tuples", () => {
    expect(
      parseBinanceKlines([
        [1, "100", "101", "99", "100.5"],
        [2, "100.5", "102", "100", "101.5"],
      ]),
    ).toEqual([100.5, 101.5]);
  });
});

describe("parseKrakenOhlc", () => {
  it("extracts close prices from Kraken OHLC payloads", () => {
    expect(
      parseKrakenOhlc({
        result: {
          XXBTZUSD: [
            [1, "100", "101", "99", "100.4"],
            [2, "100.4", "101", "98", "99.8"],
          ],
          last: 2,
        },
      }),
    ).toEqual([100.4, 99.8]);
  });
});

describe("buildMarketContext", () => {
  it("combines public market, mempool, and volatility context", () => {
    const context = buildMarketContext({
      klines: [
        [1, "100", "101", "99", "100.5"],
        [2, "100.5", "102", "100", "101.5"],
        [3, "101.5", "102", "99", "100.8"],
      ],
      ticker24h: {
        lastPrice: "100.8",
        priceChangePercent: "2.5",
        volume: "12000",
        quoteVolume: "1200000000",
      },
      mempoolFees: {
        fastestFee: 12,
        halfHourFee: 10,
        hourFee: 8,
        economyFee: 5,
        minimumFee: 1,
      },
      coingeckoMarkets: [
        {
          current_price: 100.7,
          total_volume: 900000000,
          high_24h: 103,
          low_24h: 98,
          price_change_percentage_24h: 2.1,
          last_updated: "2026-05-29T16:00:00Z",
        },
      ],
      alternativeFearGreed: {
        data: [
          {
            value: "72",
            value_classification: "Greed",
            timestamp: "1780000000",
          },
        ],
      },
    });

    expect(context.volatility.realizedVolBpsPerSecond).toBeGreaterThan(0);
    expect(context.mempoolFees?.fastestFee).toBe(12);
    expect(context.coingecko?.currentPriceUsd).toBe(100.7);
    expect(context.sentiment?.label).toBe("Greed");
    expect(context.sentiment?.value).toBe(72);
  });
});

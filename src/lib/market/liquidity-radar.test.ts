import { describe, expect, it } from "vitest";
import {
  buildLiquidityRadar,
  parseBitfinexBook,
  parseBitstampBook,
  parseCoinbaseRestBook,
  parseGeminiBook,
  parseKrakenDepthBook,
  parseKuCoinBook,
  parseOkxBook,
} from "./liquidity-radar";

describe("liquidity radar parsers", () => {
  it("normalizes Coinbase REST level2 books", () => {
    const book = parseCoinbaseRestBook({
      sequence: 9,
      bids: [["70090", "0.4", 1]],
      asks: [["70000", "0.3", 1]],
    }, 1000);

    expect(book?.exchangeId).toBe("coinbase");
    expect(book?.quoteAsset).toBe("USD");
    expect(book?.bids[0]).toEqual({ price: 70090, size: 0.4 });
    expect(book?.asks[0]).toEqual({ price: 70000, size: 0.3 });
  });

  it("normalizes Kraken depth payloads", () => {
    const book = parseKrakenDepthBook({
      result: {
        XXBTZUSD: {
          bids: [["70100.1", "0.5", 1]],
          asks: [["70020.2", "0.25", 1]],
        },
      },
    }, 2000);

    expect(book?.exchangeId).toBe("kraken");
    expect(book?.bids[0]).toEqual({ price: 70100.1, size: 0.5 });
    expect(book?.asks[0]).toEqual({ price: 70020.2, size: 0.25 });
  });

  it("normalizes Bitstamp, Bitfinex, and OKX snapshots", () => {
    const bitstamp = parseBitstampBook({ timestamp: "10", bids: [["70110", "0.7"]], asks: [["70030", "0.6"]] }, 3000);
    const bitfinex = parseBitfinexBook([[70120, 2, 0.8], [70040, 2, -0.9]], 4000);
    const okx = parseOkxBook({ data: [{ bids: [["70130", "1.1", "0", "1"]], asks: [["70050", "1.0", "0", "1"]] }] }, 5000);

    expect(bitstamp?.exchangeId).toBe("bitstamp");
    expect(bitfinex?.bids[0]).toEqual({ price: 70120, size: 0.8 });
    expect(bitfinex?.asks[0]).toEqual({ price: 70040, size: 0.9 });
    expect(okx?.exchangeId).toBe("okx");
    expect(okx?.quoteAsset).toBe("USDT");
  });

  it("normalizes Gemini and KuCoin snapshots", () => {
    const gemini = parseGeminiBook({
      bids: [{ price: "70100.5", amount: "0.4", timestamp: "10" }],
      asks: [{ price: "70120.5", amount: "0.3", timestamp: "10" }],
    }, 6000);
    const kucoin = parseKuCoinBook({
      code: "200000",
      data: {
        sequence: "123",
        bids: [["70110.1", "0.7"]],
        asks: [["70130.2", "0.6"]],
      },
    }, 7000);

    expect(gemini?.exchangeId).toBe("gemini");
    expect(gemini?.quoteAsset).toBe("USD");
    expect(gemini?.bids[0]).toEqual({ price: 70100.5, size: 0.4 });
    expect(kucoin?.exchangeId).toBe("kucoin");
    expect(kucoin?.quoteAsset).toBe("USDT");
    expect(kucoin?.asks[0]).toEqual({ price: 70130.2, size: 0.6 });
  });
});

describe("buildLiquidityRadar", () => {
  it("keeps quote lanes separate and ranks executable cross-venue routes", () => {
    const radar = buildLiquidityRadar({
      books: [
        {
          exchangeId: "kraken",
          symbol: "BTC/USD",
          baseAsset: "BTC",
          quoteAsset: "USD",
          bids: [{ price: 70050, size: 1 }],
          asks: [{ price: 70000, size: 1 }],
          receivedAt: 1000,
        },
        {
          exchangeId: "coinbase",
          symbol: "BTC-USD",
          baseAsset: "BTC",
          quoteAsset: "USD",
          bids: [{ price: 70450, size: 1 }],
          asks: [{ price: 70480, size: 1 }],
          receivedAt: 1000,
        },
        {
          exchangeId: "okx",
          symbol: "BTC-USDT",
          baseAsset: "BTC",
          quoteAsset: "USDT",
          bids: [{ price: 70470, size: 1 }],
          asks: [{ price: 70490, size: 1 }],
          receivedAt: 1000,
        },
      ],
      targetSizeBtc: 0.5,
      observedAt: 1100,
      sources: ["coinbase", "kraken", "okx"],
    });

    expect(radar.books).toHaveLength(3);
    expect(radar.routes[0]?.buyExchange).toBe("kraken");
    expect(radar.routes[0]?.sellExchange).toBe("coinbase");
    expect(radar.routes.every((route) => route.quoteAsset === "USD" || route.buyExchange !== "kraken" || route.sellExchange !== "okx")).toBe(true);
    expect(radar.frontier.length).toBeGreaterThan(0);
    expect(radar.summary.venuesLoaded).toBe(3);
    expect(radar.summary.bestNetProfitUsd).toBe(radar.routes[0]?.netProfitUsd);
  });

  it("marks shallow routes as rejected instead of pretending full execution", () => {
    const radar = buildLiquidityRadar({
      books: [
        {
          exchangeId: "bitstamp",
          symbol: "btcusd",
          baseAsset: "BTC",
          quoteAsset: "USD",
          bids: [{ price: 70000, size: 0.05 }],
          asks: [{ price: 69900, size: 0.05 }],
          receivedAt: 1000,
        },
        {
          exchangeId: "bitfinex",
          symbol: "tBTCUSD",
          baseAsset: "BTC",
          quoteAsset: "USD",
          bids: [{ price: 70300, size: 0.04 }],
          asks: [{ price: 70400, size: 0.04 }],
          receivedAt: 1000,
        },
      ],
      targetSizeBtc: 0.5,
      observedAt: 1000,
    });

    expect(radar.routes[0]?.complete).toBe(false);
    expect(radar.routes[0]?.rejectionReasons).toContain("Insufficient executable depth");
  });
});

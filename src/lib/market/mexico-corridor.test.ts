import { describe, expect, it } from "vitest";
import { buildMexicoCorridorLab, parseBitsoOrderBook, parseCoinbaseUsdBook } from "./mexico-corridor";

describe("mexico corridor parsers", () => {
  it("normalizes Bitso BTC/MXN and USD/MXN books", () => {
    const btcMxn = parseBitsoOrderBook("btc_mxn", {
      success: true,
      payload: {
        sequence: "10",
        updated_at: "2026-05-29T12:00:00.000+00:00",
        asks: [{ book: "btc_mxn", price: "1270000", amount: "0.4" }],
        bids: [{ book: "btc_mxn", price: "1269000", amount: "0.5" }],
      },
    }, 1000);
    const usdMxn = parseBitsoOrderBook("usd_mxn", {
      success: true,
      payload: {
        asks: [{ book: "usd_mxn", price: "17.50", amount: "10000" }],
        bids: [{ book: "usd_mxn", price: "17.40", amount: "12000" }],
      },
    }, 2000);

    expect(btcMxn?.baseAsset).toBe("BTC");
    expect(btcMxn?.quoteAsset).toBe("MXN");
    expect(btcMxn?.asks[0]).toEqual({ price: 1270000, size: 0.4 });
    expect(usdMxn?.baseAsset).toBe("USD");
    expect(usdMxn?.quoteAsset).toBe("MXN");
    expect(usdMxn?.bids[0]).toEqual({ price: 17.4, size: 12000 });
  });

  it("normalizes Coinbase BTC-USD books for corridor simulation", () => {
    const book = parseCoinbaseUsdBook({
      sequence: 5,
      asks: [["70000", "0.3", 1]],
      bids: [["69950", "0.2", 1]],
    }, 3000);

    expect(book?.exchangeId).toBe("coinbase");
    expect(book?.baseAsset).toBe("BTC");
    expect(book?.quoteAsset).toBe("USD");
    expect(book?.asks[0]).toEqual({ price: 70000, size: 0.3 });
  });
});

describe("buildMexicoCorridorLab", () => {
  it("walks BTC and FX depth to rank executable Mexico corridor routes", () => {
    const lab = buildMexicoCorridorLab({
      coinbaseBtcUsd: coinbaseBook({ ask: 70000, bid: 69920 }),
      bitsoBtcMxn: bitsoBtcMxnBook({ ask: 1220000, bid: 1260000 }),
      bitsoUsdMxn: bitsoUsdMxnBook({ ask: 17.45, bid: 17.35 }),
      targetSizeBtc: 0.25,
      feeBps: { coinbase: 0, bitso: 0, fx: 0 },
      rebalanceCostUsd: 5,
      observedAt: 4000,
    });

    expect(lab.routes).toHaveLength(2);
    expect(lab.bestRoute?.id).toBe("coinbase-usd-to-bitso-mxn");
    expect(lab.bestRoute?.complete).toBe(true);
    expect(lab.bestRoute?.netPnlUsd).toBeGreaterThan(0);
    expect(lab.bestRoute?.legs.map((leg) => leg.pair)).toEqual(["BTC-USD", "btc_mxn", "usd_mxn"]);
    expect(lab.summary.executableRoutes).toBe(1);
  });

  it("rejects routes when FX depth cannot convert the simulated proceeds", () => {
    const lab = buildMexicoCorridorLab({
      coinbaseBtcUsd: coinbaseBook({ ask: 70000, bid: 69920 }),
      bitsoBtcMxn: bitsoBtcMxnBook({ ask: 1220000, bid: 1260000 }),
      bitsoUsdMxn: bitsoUsdMxnBook({ ask: 17.45, bid: 17.35, usdAskSize: 100 }),
      targetSizeBtc: 0.25,
      feeBps: { coinbase: 0, bitso: 0, fx: 0 },
      observedAt: 4000,
    });

    const route = lab.routes.find((item) => item.id === "coinbase-usd-to-bitso-mxn");
    expect(route?.complete).toBe(false);
    expect(route?.rejectionReasons).toContain("Insufficient USD/MXN ask depth to convert MXN proceeds");
  });
});

function coinbaseBook(input: { ask: number; bid: number }) {
  return {
    exchangeId: "coinbase" as const,
    pair: "BTC-USD" as const,
    baseAsset: "BTC" as const,
    quoteAsset: "USD" as const,
    asks: [{ price: input.ask, size: 1 }],
    bids: [{ price: input.bid, size: 1 }],
    receivedAt: 1000,
  };
}

function bitsoBtcMxnBook(input: { ask: number; bid: number }) {
  return {
    exchangeId: "bitso" as const,
    pair: "btc_mxn" as const,
    baseAsset: "BTC" as const,
    quoteAsset: "MXN" as const,
    asks: [{ price: input.ask, size: 1 }],
    bids: [{ price: input.bid, size: 1 }],
    receivedAt: 1000,
  };
}

function bitsoUsdMxnBook(input: { ask: number; bid: number; usdAskSize?: number }) {
  return {
    exchangeId: "bitso" as const,
    pair: "usd_mxn" as const,
    baseAsset: "USD" as const,
    quoteAsset: "MXN" as const,
    asks: [{ price: input.ask, size: input.usdAskSize ?? 100000 }],
    bids: [{ price: input.bid, size: 100000 }],
    receivedAt: 1000,
  };
}

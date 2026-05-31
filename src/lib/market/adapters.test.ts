import { describe, expect, it } from "vitest";
import { normalizeExchangeMessage } from "./adapters";

describe("normalizeExchangeMessage", () => {
  it("normalizes Kraken v2 book snapshots", () => {
    const events = normalizeExchangeMessage("kraken", {
      channel: "book",
      type: "snapshot",
      data: [
        {
          symbol: "BTC/USD",
          bids: [{ price: 70100.1, qty: 0.8 }],
          asks: [{ price: 70101.2, qty: 0.6 }],
          checksum: 123,
        },
      ],
    });

    expect(events[0]).toMatchObject({
      kind: "snapshot",
      exchangeId: "kraken",
      quoteAsset: "USD",
    });
    expect(events[0]?.bids[0]).toEqual({ price: 70100.1, size: 0.8 });
  });

  it("normalizes Coinbase level2 snapshots", () => {
    const events = normalizeExchangeMessage("coinbase", {
      type: "snapshot",
      product_id: "BTC-USD",
      bids: [["70100.10", "0.8"]],
      asks: [["70101.20", "0.6"]],
    });

    expect(events[0]?.exchangeId).toBe("coinbase");
    expect(events[0]?.quoteAsset).toBe("USD");
    expect(events[0]?.asks[0]).toEqual({ price: 70101.2, size: 0.6 });
  });

  it("normalizes Binance, Bybit, Gemini, and Gate top-depth snapshots", () => {
    const binance = normalizeExchangeMessage("binance", {
      lastUpdateId: 160,
      bids: [["70100.10", "0.8"]],
      asks: [["70101.20", "0.6"]],
    });
    const bybit = normalizeExchangeMessage("bybit", {
      topic: "orderbook.50.BTCUSDT",
      type: "snapshot",
      ts: 1672304484978,
      data: { s: "BTCUSDT", b: [["70100.10", "0.8"]], a: [["70101.20", "0.6"]], u: 88 },
    });
    const gemini = normalizeExchangeMessage("gemini", {
      lastUpdateId: 12345678,
      bids: [["70100.10", "0.8"]],
      asks: [["70101.20", "0.6"]],
    });
    const gate = normalizeExchangeMessage("gate", {
      channel: "spot.order_book",
      result: {
        t: 1672304484978,
        id: 321,
        s: "BTC_USDT",
        bids: [["70100.10", "0.8"]],
        asks: [["70101.20", "0.6"]],
      },
    });

    expect(binance[0]?.quoteAsset).toBe("USDT");
    expect(bybit[0]?.exchangeId).toBe("bybit");
    expect(gemini[0]?.symbol).toBe("BTC/USD");
    expect(gate[0]?.sequence).toBe(321);
  });

  it("normalizes OKX books5 snapshots", () => {
    const events = normalizeExchangeMessage("okx", {
      arg: { channel: "books5", instId: "BTC-USDT" },
      data: [
        {
          asks: [["70101.20", "0.6", "0", "2"]],
          bids: [["70100.10", "0.8", "0", "3"]],
          ts: "1672304484978",
          seqId: 991,
        },
      ],
    });

    expect(events[0]).toMatchObject({
      kind: "snapshot",
      exchangeId: "okx",
      symbol: "BTC/USDT",
      quoteAsset: "USDT",
      sequence: 991,
    });
    expect(events[0]?.bids[0]).toEqual({ price: 70100.1, size: 0.8 });
    expect(events[0]?.asks[0]).toEqual({ price: 70101.2, size: 0.6 });
  });

  it("normalizes Bitfinex book snapshots and zero-count removals", () => {
    const snapshot = normalizeExchangeMessage("bitfinex", [
      42,
      [
        [70100.1, 2, 0.8],
        [70101.2, 1, -0.6],
      ],
    ]);
    const remove = normalizeExchangeMessage("bitfinex", [42, [70100.1, 0, 1]]);

    expect(snapshot[0]).toMatchObject({
      kind: "snapshot",
      exchangeId: "bitfinex",
      symbol: "BTC/USD",
      quoteAsset: "USD",
    });
    expect(snapshot[0]?.bids[0]).toEqual({ price: 70100.1, size: 0.8 });
    expect(snapshot[0]?.asks[0]).toEqual({ price: 70101.2, size: 0.6 });
    expect(remove[0]).toMatchObject({ kind: "delta", exchangeId: "bitfinex" });
    expect(remove[0]?.bids[0]).toEqual({ price: 70100.1, size: 0 });
  });

  it("normalizes Bitstamp order book payloads", () => {
    const events = normalizeExchangeMessage("bitstamp", {
      event: "data",
      channel: "order_book_btcusd",
      data: {
        timestamp: "1672304484",
        microtimestamp: "1672304484978000",
        bids: [["70100.10", "0.8"]],
        asks: [["70101.20", "0.6"]],
      },
    });

    expect(events[0]).toMatchObject({
      kind: "snapshot",
      exchangeId: "bitstamp",
      symbol: "BTC/USD",
      quoteAsset: "USD",
      exchangeTimestamp: 1672304484978,
    });
    expect(events[0]?.asks[0]).toEqual({ price: 70101.2, size: 0.6 });
  });

  it("normalizes Gemini modern depth and book ticker streams", () => {
    const depth = normalizeExchangeMessage("gemini", {
      lastUpdateId: 12345678,
      bids: [["70100.10", "0.8"]],
      asks: [["70101.20", "0.6"]],
    });
    const ticker = normalizeExchangeMessage("gemini", {
      u: 12345679,
      E: 1751508438600117161,
      s: "btcusd",
      b: "70100.10",
      B: "0.8",
      a: "70101.20",
      A: "0.6",
    });

    expect(depth[0]).toMatchObject({ kind: "snapshot", exchangeId: "gemini", sequence: 12345678 });
    expect(ticker[0]).toMatchObject({ kind: "ticker", exchangeId: "gemini", sequence: 12345679 });
    expect(ticker[0]?.bids[0]).toEqual({ price: 70100.1, size: 0.8 });
    expect(ticker[0]?.asks[0]).toEqual({ price: 70101.2, size: 0.6 });
  });

  it("normalizes KuCoin public order book snapshots", () => {
    const events = normalizeExchangeMessage("kucoin", {
      type: "message",
      topic: "/spotMarket/level2Depth50:BTC-USDT",
      subject: "level2",
      data: {
        timestamp: 1672304484978,
        sequenceStart: "991",
        bids: [["70100.10", "0.8"]],
        asks: [["70101.20", "0.6"]],
      },
    });

    expect(events[0]).toMatchObject({
      kind: "snapshot",
      exchangeId: "kucoin",
      symbol: "BTC/USDT",
      quoteAsset: "USDT",
      sequence: 991,
      exchangeTimestamp: 1672304484978,
    });
    expect(events[0]?.asks[0]).toEqual({ price: 70101.2, size: 0.6 });
  });

  it("normalizes Bitget spot books50 snapshots", () => {
    const events = normalizeExchangeMessage("bitget", {
      action: "snapshot",
      arg: { instType: "spot", topic: "books50", symbol: "BTCUSDT" },
      data: [
        {
          ts: "1672304484978",
          seq: "991",
          b: [["70100.10", "0.8"]],
          a: [["70101.20", "0.6"]],
        },
      ],
    });

    expect(events[0]).toMatchObject({
      kind: "snapshot",
      exchangeId: "bitget",
      symbol: "BTC/USDT",
      quoteAsset: "USDT",
      sequence: 991,
      exchangeTimestamp: 1672304484978,
    });
    expect(events[0]?.bids[0]).toEqual({ price: 70100.1, size: 0.8 });
    expect(events[0]?.asks[0]).toEqual({ price: 70101.2, size: 0.6 });
  });
});

import { describe, expect, it } from "vitest";
import { applyBookDelta, createEmptyBookStore } from "./book-state";
import type { BookDelta } from "./types";

const baseDelta: BookDelta = {
  kind: "snapshot",
  exchangeId: "binance",
  symbol: "BTC/USDT",
  baseAsset: "BTC",
  quoteAsset: "USDT",
  bids: [
    { price: 70_000, size: 1 },
    { price: 69_990, size: 2 },
  ],
  asks: [
    { price: 70_010, size: 1 },
    { price: 70_020, size: 2 },
  ],
  receivedAt: 1000,
  sequence: 1,
};

describe("applyBookDelta", () => {
  it("applies snapshots and deltas while keeping bids desc and asks asc", () => {
    const store = createEmptyBookStore();
    applyBookDelta(store, baseDelta);
    applyBookDelta(store, {
      ...baseDelta,
      kind: "delta",
      bids: [
        { price: 70_005, size: 0.5 },
        { price: 69_990, size: 0 },
      ],
      asks: [{ price: 70_010, size: 0 }],
      receivedAt: 1100,
      sequence: 2,
    });

    const snapshot = store.books.binance;
    expect(snapshot?.bids.map((level) => level.price)).toEqual([70_005, 70_000]);
    expect(snapshot?.asks.map((level) => level.price)).toEqual([70_020]);
    expect(snapshot?.receivedAt).toBe(1100);
  });
});

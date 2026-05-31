import { describe, expect, it } from "vitest";
import { buildLiquidityTopologyMap } from "./liquidity-topology";
import type { LiquidityRadar, LiquidityVenueBook } from "./liquidity-radar";

function book(input: {
  exchangeId: string;
  quoteAsset?: "USD" | "USDT";
  bid: number;
  ask: number;
  bidShape?: number[];
  askShape?: number[];
}): LiquidityVenueBook {
  const bidShape = input.bidShape ?? [1.2, 1.0, 0.8, 0.6];
  const askShape = input.askShape ?? [1.1, 0.9, 0.7, 0.5];
  const bids = bidShape.map((size, index) => ({ price: input.bid - index * 10, size }));
  const asks = askShape.map((size, index) => ({ price: input.ask + index * 10, size }));
  const mid = (input.bid + input.ask) / 2;
  return {
    exchangeId: input.exchangeId,
    symbol: `BTC-${input.quoteAsset ?? "USD"}`,
    baseAsset: "BTC",
    quoteAsset: input.quoteAsset ?? "USD",
    bids,
    asks,
    receivedAt: 1_780_000_000_000,
    topBid: input.bid,
    topAsk: input.ask,
    spreadBps: ((input.ask - input.bid) / mid) * 10_000,
    bidDepthBtc: bids.reduce((sum, level) => sum + level.size, 0),
    askDepthBtc: asks.reduce((sum, level) => sum + level.size, 0),
  };
}

function radar(books: LiquidityVenueBook[]): LiquidityRadar {
  return {
    generatedAt: 1_780_000_000_000,
    targetSizeBtc: 0.35,
    books,
    routes: [],
    frontier: [],
    summary: {
      venuesLoaded: books.length,
      usdVenues: books.filter((item) => item.quoteAsset === "USD").length,
      usdtVenues: books.filter((item) => item.quoteAsset === "USDT").length,
      routeCount: 0,
      executableRoutes: 0,
      bestNetProfitUsd: 0,
      medianSpreadBps: 1,
      sourceCount: 3,
    },
    sources: ["fixture-depth"],
    errors: [],
  };
}

describe("buildLiquidityTopologyMap", () => {
  it("maps venue book-shape distances and identifies the central venue", () => {
    const map = buildLiquidityTopologyMap({
      radar: radar([
        book({ exchangeId: "coinbase", bid: 70_000, ask: 70_010 }),
        book({ exchangeId: "kraken", bid: 70_002, ask: 70_012, bidShape: [1.1, 1.0, 0.75, 0.55] }),
        book({ exchangeId: "gemini", bid: 70_001, ask: 70_011, askShape: [1.15, 0.85, 0.7, 0.45] }),
      ]),
    });

    expect(map.summary.policy).toBe("route-normal");
    expect(map.venues).toHaveLength(3);
    expect(map.links).toHaveLength(3);
    expect(map.summary.centralVenue).toBe("coinbase");
    expect(map.summary.fragmentationScore).toBeLessThan(35);
    expect(map.links[0]?.wassersteinBps).toBeCloseTo(0, 0);
    expect(map.equation).toContain("W1");
  });

  it("flags fragmented topology when one venue shape is far away from the liquidity cluster", () => {
    const map = buildLiquidityTopologyMap({
      radar: radar([
        book({ exchangeId: "coinbase", bid: 70_000, ask: 70_010 }),
        book({ exchangeId: "kraken", bid: 70_003, ask: 70_013 }),
        book({
          exchangeId: "bitfinex",
          bid: 69_650,
          ask: 70_450,
          bidShape: [0.08, 0.12, 3.8, 5.5],
          askShape: [0.05, 0.1, 4.2, 5.9],
        }),
      ]),
    });

    expect(map.summary.policy).toBe("avoid-fragmented-route");
    expect(map.summary.fragmentationScore).toBeGreaterThan(65);
    expect(map.outliers.map((item) => item.exchangeId)).toContain("bitfinex");
    expect(map.reasons.some((reason) => reason.includes("fragmented"))).toBe(true);
  });

  it("returns insufficient-data when fewer than two same-lane books exist", () => {
    const map = buildLiquidityTopologyMap({
      radar: radar([book({ exchangeId: "coinbase", bid: 70_000, ask: 70_010 })]),
    });

    expect(map.summary.policy).toBe("insufficient-data");
    expect(map.links).toHaveLength(0);
    expect(map.reasons).toContain("Need at least two books in the same quote lane to compare liquidity topology.");
  });
});

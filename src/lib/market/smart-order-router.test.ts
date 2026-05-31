import { describe, expect, it } from "vitest";
import { buildSmartOrderRouter } from "./smart-order-router";
import type { LiquidityRadar, LiquidityVenueBook } from "./liquidity-radar";
import type { VenueReliabilityOracle } from "./venue-reliability";
import type { WalletState } from "./types";

describe("buildSmartOrderRouter", () => {
  it("splits an arbitrage route across marginal depth and beats the best single venue route", () => {
    const plan = buildSmartOrderRouter({
      radar: radar([
        book("coinbase", "USD", [[73_000, 0.2], [73_030, 0.2]], [[73_090, 0.2]]),
        book("bitstamp", "USD", [[73_010, 0.3]], [[73_080, 0.2]]),
        book("kraken", "USD", [[73_060, 0.2]], [[73_850, 0.25], [73_820, 0.2]]),
        book("gemini", "USD", [[73_070, 0.2]], [[73_840, 0.3]]),
      ]),
      wallets,
      targetSizeBtc: 0.5,
      observedAt: 1_700_000_000_000,
    });

    expect(plan.summary.policy).toBe("split-route");
    expect(new Set(plan.buySlices.map((slice) => slice.exchangeId)).size).toBeGreaterThan(1);
    expect(new Set(plan.sellSlices.map((slice) => slice.exchangeId)).size).toBeGreaterThan(1);
    expect(plan.summary.netProfitUsd).toBeGreaterThan(plan.summary.bestSingleRouteNetUsd);
    expect(plan.summary.improvementUsd).toBeGreaterThan(0);
    expect(plan.equation).toContain("marginal_edge");
  });

  it("excludes halted venues and caps size to prefunded wallet inventory", () => {
    const plan = buildSmartOrderRouter({
      radar: radar([
        book("coinbase", "USD", [[73_000, 0.4]], [[73_080, 0.2]]),
        book("kraken", "USD", [[73_005, 0.4]], [[73_900, 0.5]]),
        book("gemini", "USD", [[73_025, 0.4]], [[73_950, 0.4]]),
      ]),
      wallets: {
        coinbase: { BTC: 0, USD: 16_000, USDT: 0 },
        kraken: { BTC: 1, USD: 80_000, USDT: 0 },
        gemini: { BTC: 0.22, USD: 80_000, USDT: 0 },
      },
      reliability: reliability("kraken", "halt"),
      targetSizeBtc: 0.5,
      observedAt: 1_700_000_000_000,
    });

    expect(plan.sellSlices.some((slice) => slice.exchangeId === "kraken")).toBe(false);
    expect(plan.summary.tradeSizeBtc).toBeLessThan(0.5);
    expect(plan.summary.policy).toBe("cap-size");
    expect(plan.rejectionReasons).toContain("venue reliability halt excluded");
    expect(plan.rejectionReasons).toContain("prefunded wallet capacity capped route size");
  });
});

const wallets: WalletState = {
  coinbase: { BTC: 0.2, USD: 80_000, USDT: 0 },
  bitstamp: { BTC: 0.2, USD: 80_000, USDT: 0 },
  kraken: { BTC: 0.4, USD: 80_000, USDT: 0 },
  gemini: { BTC: 0.4, USD: 80_000, USDT: 0 },
};

function radar(books: LiquidityVenueBook[]): LiquidityRadar {
  return {
    generatedAt: 1_700_000_000_000,
    targetSizeBtc: 0.5,
    books,
    routes: [
      {
        buyExchange: "coinbase",
        sellExchange: "kraken",
        quoteAsset: "USD",
        tradeSizeBtc: 0.5,
        complete: true,
        grossProfitUsd: 70,
        feeCostUsd: 40,
        rebalanceCostUsd: 5,
        latencyCostUsd: 2,
        netProfitUsd: 23,
        edgeBps: 6,
        buyVwap: 73_020,
        sellVwap: 73_190,
        routeScore: 82,
        rejectionReasons: [],
      },
    ],
    frontier: [],
    summary: {
      venuesLoaded: books.length,
      usdVenues: books.length,
      usdtVenues: 0,
      routeCount: 1,
      executableRoutes: 1,
      bestNetProfitUsd: 23,
      medianSpreadBps: 8,
      sourceCount: 4,
    },
    sources: ["fixture"],
    errors: [],
  };
}

function book(
  exchangeId: string,
  quoteAsset: "USD" | "USDT",
  asks: Array<[number, number]>,
  bids: Array<[number, number]>,
): LiquidityVenueBook {
  const topBid = bids[0]?.[0] ?? 0;
  const topAsk = asks[0]?.[0] ?? 0;
  const mid = (topBid + topAsk) / 2;
  return {
    exchangeId,
    symbol: quoteAsset === "USD" ? "BTC-USD" : "BTC-USDT",
    baseAsset: "BTC",
    quoteAsset,
    bids: bids.map(([price, size]) => ({ price, size })),
    asks: asks.map(([price, size]) => ({ price, size })),
    receivedAt: 1_700_000_000_000,
    topBid,
    topAsk,
    spreadBps: mid > 0 ? ((topAsk - topBid) / mid) * 10_000 : 0,
    bidDepthBtc: bids.reduce((sum, [, size]) => sum + size, 0),
    askDepthBtc: asks.reduce((sum, [, size]) => sum + size, 0),
  };
}

function reliability(venue: string, policy: "allow" | "cap-size" | "halt"): VenueReliabilityOracle {
  return {
    generatedAt: 1_700_000_000_000,
    venues: [
      {
        venue: venue as never,
        label: venue,
        indicator: policy === "halt" ? "critical" : policy === "cap-size" ? "minor" : "none",
        description: policy,
        fetchedAt: 1_700_000_000_000,
        source: "status",
        operationalScore: policy === "halt" ? 12 : 90,
        statusPenaltyBps: policy === "halt" ? 18 : 0,
        latencyPenaltyBps: 0,
        feedPenaltyBps: 0,
        totalHaircutBps: policy === "halt" ? 18 : 0,
        policy,
        reasons: policy === "halt" ? ["public status critical"] : [],
      },
    ],
    summary: {
      venueCount: 1,
      healthyVenues: policy === "allow" ? 1 : 0,
      cappedVenues: policy === "cap-size" ? 1 : 0,
      haltedVenues: policy === "halt" ? 1 : 0,
      averageScore: 80,
      worstVenue: venue as never,
      worstScore: policy === "halt" ? 12 : 90,
      totalHaircutBps: policy === "halt" ? 18 : 0,
      policy: policy === "halt" ? "exclude-risky-venues" : "allow-routing",
    },
    equation: "test",
    sources: ["status"],
    errors: [],
  };
}

import { describe, expect, it } from "vitest";
import {
  buildVenueIntelligence,
  buildVenueRoutes,
  parseCoinGeckoVenueTickers,
  type VenueTicker,
} from "./venue-intelligence";

const fixture = {
  tickers: [
    {
      base: "BTC",
      target: "USDT",
      market: { name: "Binance", identifier: "binance" },
      converted_last: { usd: 100_000 },
      converted_volume: { usd: 1_500_000_000 },
      bid_ask_spread_percentage: 0.01,
      cost_to_move_up_usd: 20_000_000,
      cost_to_move_down_usd: 18_000_000,
      trust_score: "green",
      is_stale: false,
      is_anomaly: false,
      last_fetch_at: "2026-05-29T16:00:00Z",
    },
    {
      base: "BTC",
      target: "USDT",
      market: { name: "Gate.io", identifier: "gate" },
      converted_last: { usd: 100_250 },
      converted_volume: { usd: 600_000_000 },
      bid_ask_spread_percentage: 0.03,
      cost_to_move_up_usd: 5_000_000,
      cost_to_move_down_usd: 4_500_000,
      trust_score: "green",
      is_stale: false,
      is_anomaly: false,
      last_fetch_at: "2026-05-29T16:00:00Z",
    },
    {
      base: "BTC",
      target: "EUR",
      market: { name: "Other", identifier: "other" },
      converted_last: { usd: 100_100 },
      converted_volume: { usd: 100_000 },
    },
  ],
};

describe("parseCoinGeckoVenueTickers", () => {
  it("normalizes tracked BTC USD/USDT tickers into venue quality records", () => {
    const tickers = parseCoinGeckoVenueTickers(fixture);

    expect(tickers).toHaveLength(2);
    expect(tickers[0]?.exchangeId).toBe("binance");
    expect(tickers[0]?.qualityScore).toBeGreaterThan(70);
    expect(tickers.map((ticker) => ticker.quoteAsset)).toEqual(["USDT", "USDT"]);
  });
});

describe("buildVenueRoutes", () => {
  it("builds same-lane route candidates with positive gross spreads", () => {
    const tickers: VenueTicker[] = parseCoinGeckoVenueTickers(fixture);
    const routes = buildVenueRoutes(tickers);

    expect(routes[0]?.buyExchange).toBe("binance");
    expect(routes[0]?.sellExchange).toBe("gate");
    expect(routes[0]?.grossSpreadBps).toBeGreaterThan(20);
    expect(routes[0]?.routeScore).toBeGreaterThan(0);
  });
});

describe("buildVenueIntelligence", () => {
  it("summarizes venue coverage, spreads, volume, and source health", () => {
    const intelligence = buildVenueIntelligence({ coinGeckoTickers: fixture });

    expect(intelligence.summary.venuesTracked).toBe(2);
    expect(intelligence.summary.totalVolumeUsd).toBe(2_100_000_000);
    expect(intelligence.summary.bestRouteScore).toBeGreaterThan(0);
    expect(intelligence.sources[0]).toContain("coingecko");
  });
});

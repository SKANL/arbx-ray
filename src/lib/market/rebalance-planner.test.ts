import { describe, expect, it } from "vitest";
import { buildRebalancePlanner } from "./rebalance-planner";
import type { WalletState } from "./types";

const wallets: WalletState = {
  kraken: { BTC: 0.05, USD: 180_000, USDT: 0 },
  coinbase: { BTC: 2.2, USD: 10_000, USDT: 0 },
  binance: { BTC: 0.1, USD: 0, USDT: 170_000 },
  bybit: { BTC: 2.1, USD: 0, USDT: 15_000 },
};

describe("buildRebalancePlanner", () => {
  it("detects buy and sell capacity bottlenecks from simulated wallets", () => {
    const planner = buildRebalancePlanner({
      wallets,
      btcUsd: 70_000,
      fastestFeeSatVb: 32,
      targetBtcPerVenue: 1,
      targetQuoteUsdPerVenue: 75_000,
    });

    expect(planner.summary.totalCapitalUsd).toBeGreaterThan(0);
    expect(planner.venues.find((venue) => venue.exchangeId === "kraken")?.sellCapacityBtc).toBe(0.05);
    expect(planner.venues.find((venue) => venue.exchangeId === "coinbase")?.buyCapacityBtc).toBeCloseTo(10_000 / 70_000, 6);
    expect(planner.summary.sellConstrainedVenues).toBeGreaterThan(0);
    expect(planner.summary.buyConstrainedVenues).toBeGreaterThan(0);
  });

  it("proposes simulated BTC transfers from surplus venues to deficient venues", () => {
    const planner = buildRebalancePlanner({
      wallets,
      btcUsd: 70_000,
      fastestFeeSatVb: 32,
      targetBtcPerVenue: 1,
      targetQuoteUsdPerVenue: 75_000,
    });

    expect(planner.actions[0]?.asset).toBe("BTC");
    expect(planner.actions[0]?.fromExchange).toBe("coinbase");
    expect(planner.actions[0]?.toExchange).toBe("kraken");
    expect(planner.actions[0]?.amount).toBeGreaterThan(0);
    expect(planner.actions[0]?.estimatedCostUsd).toBeGreaterThan(0);
    expect(planner.actions[0]?.simulatedOnly).toBe(true);
  });

  it("raises urgency when mempool fees make rebalancing expensive", () => {
    const calm = buildRebalancePlanner({
      wallets,
      btcUsd: 70_000,
      fastestFeeSatVb: 8,
      targetBtcPerVenue: 1,
      targetQuoteUsdPerVenue: 75_000,
    });
    const expensive = buildRebalancePlanner({
      wallets,
      btcUsd: 70_000,
      fastestFeeSatVb: 80,
      targetBtcPerVenue: 1,
      targetQuoteUsdPerVenue: 75_000,
    });

    expect(expensive.summary.estimatedTotalRebalanceCostUsd).toBeGreaterThan(calm.summary.estimatedTotalRebalanceCostUsd);
    expect(expensive.policy).toBe("defer-noncritical");
  });

  it("handles an empty wallet set without non-finite capacity values", () => {
    const planner = buildRebalancePlanner({
      wallets: {},
      btcUsd: 70_000,
      fastestFeeSatVb: 12,
    });

    expect(planner.venues).toEqual([]);
    expect(planner.summary.maxRouteSizeBtc).toBe(0);
    expect(Number.isFinite(planner.summary.totalCapitalUsd)).toBe(true);
  });
});

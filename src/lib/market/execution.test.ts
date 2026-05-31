import { describe, expect, it } from "vitest";
import {
  evaluateOpportunity,
  executeAcceptedTrade,
  simulateMarketFill,
} from "./execution";
import type { EngineConfig, OrderBookSnapshot, WalletState } from "./types";

const now = 1_780_100_000_000;

function book(
  exchangeId: string,
  quoteAsset: "USD" | "USDT",
  bids: [number, number][],
  asks: [number, number][],
  receivedAt = now,
): OrderBookSnapshot {
  return {
    exchangeId,
    symbol: quoteAsset === "USD" ? "BTC/USD" : "BTC/USDT",
    baseAsset: "BTC",
    quoteAsset,
    bids: bids.map(([price, size]) => ({ price, size })),
    asks: asks.map(([price, size]) => ({ price, size })),
    exchangeTimestamp: receivedAt - 20,
    receivedAt,
    sequence: 42,
  };
}

const config: EngineConfig = {
  maxTradeBtc: 1,
  minNetProfitUsd: 5,
  staleBookMs: 1_500,
  maxLatencyMs: 600,
  latencyVolatilityBpsPerSecond: 10,
  withdrawalFeeBtc: 0.00008,
  usdtUsdHaircutBps: 12,
  feesBps: {
    kraken: 26,
    coinbase: 60,
    binance: 10,
    bybit: 10,
    gemini: 40,
    gate: 20,
    bitfinex: 20,
    bitstamp: 40,
    okx: 10,
  },
};

describe("simulateMarketFill", () => {
  it("walks order book levels and returns a partial fill when depth is insufficient", () => {
    const fill = simulateMarketFill(
      [
        { price: 70_000, size: 0.25 },
        { price: 70_020, size: 0.5 },
      ],
      1,
    );

    expect(fill.filledBtc).toBe(0.75);
    expect(fill.complete).toBe(false);
    expect(fill.vwap).toBeCloseTo(70_013.3333, 4);
    expect(fill.levelsUsed).toHaveLength(2);
  });
});

describe("evaluateOpportunity", () => {
  it("accepts only same-quote executable spreads after fees, latency, and balances", () => {
    const buyBook = book("kraken", "USD", [[70_000, 1]], [[70_000, 1]]);
    const sellBook = book("coinbase", "USD", [[70_900, 1]], [[70_920, 1]]);
    const wallets: WalletState = {
      kraken: { BTC: 0.2, USD: 100_000, USDT: 0 },
      coinbase: { BTC: 1, USD: 10_000, USDT: 0 },
    };

    const decision = evaluateOpportunity(buyBook, sellBook, wallets, config, now + 40);

    expect(decision.status).toBe("accepted");
    expect(decision.tradeSizeBtc).toBeGreaterThan(0);
    expect(decision.netProfitUsd).toBeGreaterThan(5);
    expect(decision.risk.reasons).toContain("Same quote lane: USD");
  });

  it("rejects stale, cross-lane, or negative-net opportunities with explicit reasons", () => {
    const buyBook = book("binance", "USDT", [[70_000, 1]], [[70_000, 1]], now - 5_000);
    const sellBook = book("coinbase", "USD", [[70_090, 1]], [[70_100, 1]], now);
    const wallets: WalletState = {
      binance: { BTC: 0, USD: 0, USDT: 100_000 },
      coinbase: { BTC: 1, USD: 10_000, USDT: 0 },
    };

    const decision = evaluateOpportunity(buyBook, sellBook, wallets, config, now);

    expect(decision.status).toBe("rejected");
    expect(decision.rejectionReasons).toContain("Cross-lane comparison requires basis haircut");
    expect(decision.rejectionReasons).toContain("Stale buy book");
  });

  it("accepts profitable partial fills with the executable size", () => {
    const buyBook = book("kraken", "USD", [[70_000, 1]], [[70_000, 0.25]]);
    const sellBook = book("coinbase", "USD", [[71_200, 0.25]], [[71_250, 1]]);
    const wallets: WalletState = {
      kraken: { BTC: 0, USD: 100_000, USDT: 0 },
      coinbase: { BTC: 1, USD: 10_000, USDT: 0 },
    };

    const decision = evaluateOpportunity(buyBook, sellBook, wallets, config, now);

    expect(decision.status).toBe("accepted");
    expect(decision.tradeSizeBtc).toBeCloseTo(0.25);
    expect(decision.risk.reasons).toContain("Partial fill due to shallow book");
    expect(decision.rejectionReasons).not.toContain("Partial fill due to shallow book");
  });

  it("sizes buy capacity after buy fees and withdrawal reserve", () => {
    const buyBook = book("kraken", "USD", [[70_000, 1]], [[70_000, 1]]);
    const sellBook = book("coinbase", "USD", [[71_400, 1]], [[71_450, 1]]);
    const wallets: WalletState = {
      kraken: { BTC: 0, USD: 70_000, USDT: 0 },
      coinbase: { BTC: 1, USD: 10_000, USDT: 0 },
    };

    const decision = evaluateOpportunity(buyBook, sellBook, wallets, config, now);
    const totalBuyDebit = decision.buyFill.notional + (decision.risk.buyFeeUsd ?? 0) + decision.risk.withdrawalCostUsd;

    expect(decision.tradeSizeBtc).toBeLessThan(1);
    expect(totalBuyDebit).toBeLessThanOrEqual(wallets.kraken.USD + 0.01);
  });
});

describe("executeAcceptedTrade", () => {
  it("updates prefunded simulated wallets without using real custody", () => {
    const buyBook = book("kraken", "USD", [[70_000, 1]], [[70_000, 1]]);
    const sellBook = book("coinbase", "USD", [[70_900, 1]], [[70_920, 1]]);
    const wallets: WalletState = {
      kraken: { BTC: 0, USD: 100_000, USDT: 0 },
      coinbase: { BTC: 1, USD: 10_000, USDT: 0 },
    };

    const decision = evaluateOpportunity(buyBook, sellBook, wallets, config, now);
    const result = executeAcceptedTrade(decision, wallets);

    expect(result.wallets.kraken.BTC).toBeGreaterThan(0);
    expect(result.wallets.kraken.USD).toBeCloseTo(
      100_000 - decision.buyFill.notional - (decision.risk.buyFeeUsd ?? 0) - decision.risk.withdrawalCostUsd,
      2,
    );
    expect(result.wallets.coinbase.BTC).toBeLessThan(1);
    expect(result.wallets.coinbase.USD).toBeCloseTo(
      10_000 + decision.sellFill.notional - (decision.risk.sellFeeUsd ?? 0),
      2,
    );
  });
});

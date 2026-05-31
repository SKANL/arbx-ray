import { describe, expect, it } from "vitest";
import { evaluateOpportunity } from "./execution";
import { refreshReplayBookForEvaluation } from "./replay";
import type { EngineConfig, OrderBookSnapshot, WalletState } from "./types";

const config: EngineConfig = {
  maxTradeBtc: 0.75,
  minNetProfitUsd: 3,
  staleBookMs: 2_500,
  maxLatencyMs: 900,
  latencyVolatilityBpsPerSecond: 8,
  withdrawalFeeBtc: 0.00008,
  usdtUsdHaircutBps: 12,
  feesBps: { kraken: 26, coinbase: 60 },
};

const wallets: WalletState = {
  kraken: { BTC: 0.75, USD: 125_000, USDT: 0 },
  coinbase: { BTC: 1.25, USD: 125_000, USDT: 0 },
};

function replayBook(exchangeId: "kraken" | "coinbase", receivedAt: number): OrderBookSnapshot {
  return exchangeId === "kraken"
    ? {
        exchangeId,
        symbol: "BTC/USD",
        baseAsset: "BTC",
        quoteAsset: "USD",
        bids: [{ price: 69_980, size: 1.2 }],
        asks: [
          { price: 70_000, size: 0.4 },
          { price: 70_030, size: 1.2 },
        ],
        receivedAt,
      }
    : {
        exchangeId,
        symbol: "BTC-USD",
        baseAsset: "BTC",
        quoteAsset: "USD",
        bids: [
          { price: 70_920, size: 0.35 },
          { price: 70_870, size: 1.2 },
        ],
        asks: [{ price: 70_960, size: 1 }],
        receivedAt,
      };
}

describe("refreshReplayBookForEvaluation", () => {
  it("keeps deterministic replay books fresh for latency gates", () => {
    const seededAt = 1_780_100_000_000;
    const observedAt = seededAt + 5_000;
    const staleBuy = replayBook("kraken", seededAt);
    const staleSell = replayBook("coinbase", seededAt);
    const stale = evaluateOpportunity(staleBuy, staleSell, wallets, config, observedAt);
    const refreshed = evaluateOpportunity(
      refreshReplayBookForEvaluation(staleBuy, observedAt),
      refreshReplayBookForEvaluation(staleSell, observedAt),
      wallets,
      config,
      observedAt,
    );

    expect(stale.rejectionReasons).toContain("Excessive latency");
    expect(refreshed.rejectionReasons).not.toContain("Excessive latency");
    expect(refreshed.status).toBe("accepted");
  });
});

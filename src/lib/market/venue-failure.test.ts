import { describe, expect, it } from "vitest";
import { buildVenueFailureWarGame, type FailureGameDecision } from "./venue-failure";
import type { VenueReliabilityOracle } from "./venue-reliability";
import type { WalletState } from "./types";

describe("buildVenueFailureWarGame", () => {
  it("simulates a sell-venue outage after the buy leg and recommends failover when alternate inventory exists", () => {
    const game = buildVenueFailureWarGame({
      decision: decision("coinbase", "kraken", 73_000, 73_180, 0.35),
      wallets,
      reliability: reliability("kraken", "halt", 22),
      btcUsd: 73_100,
      settlementPenaltyBps: 4,
    });

    expect(game.summary.policy).toBe("failover-required");
    expect(game.summary.worstScenario).toBe("sell-venue-outage");
    const sellOutage = game.scenarios.find((scenario) => scenario.id === "sell-venue-outage");
    expect(sellOutage?.recoveryAction).toBe("route-to-backup-venue");
    expect(sellOutage?.unwindPnlUsd).toBeLessThan(0);
    expect(sellOutage?.backupVenue).toBe("gemini");
    expect(game.equation).toContain("unwind_pnl");
  });

  it("halts when both route venues are operationally risky and no failover inventory exists", () => {
    const game = buildVenueFailureWarGame({
      decision: decision("coinbase", "kraken", 73_000, 73_180, 0.35),
      wallets: {
        coinbase: { BTC: 0, USD: 80_000, USDT: 0 },
        kraken: { BTC: 0.02, USD: 80_000, USDT: 0 },
      },
      reliability: reliability("coinbase", "halt", 20, "kraken", "halt", 25),
      btcUsd: 73_100,
      settlementPenaltyBps: 10,
    });

    expect(game.summary.policy).toBe("halt-route");
    expect(game.summary.haltedScenarios).toBeGreaterThanOrEqual(2);
    expect(game.scenarios.some((scenario) => scenario.recoveryAction === "halt-and-internalize")).toBe(true);
  });
});

const wallets: WalletState = {
  coinbase: { BTC: 0.1, USD: 100_000, USDT: 0 },
  kraken: { BTC: 0.6, USD: 60_000, USDT: 0 },
  gemini: { BTC: 0.7, USD: 50_000, USDT: 0 },
};

function decision(
  buyExchange: string,
  sellExchange: string,
  buyVwap: number,
  sellVwap: number,
  sizeBtc: number,
): FailureGameDecision {
  return {
    status: "accepted",
    buyExchange,
    sellExchange,
    quoteAsset: "USD",
    tradeSizeBtc: sizeBtc,
    buyFill: { vwap: buyVwap, filledBtc: sizeBtc, notional: buyVwap * sizeBtc, complete: true, levelsUsed: [] },
    sellFill: { vwap: sellVwap, filledBtc: sizeBtc, notional: sellVwap * sizeBtc, complete: true, levelsUsed: [] },
    netProfitUsd: (sellVwap - buyVwap) * sizeBtc - 18,
  };
}

function reliability(
  venueA: string,
  policyA: "allow" | "cap-size" | "halt",
  scoreA: number,
  venueB = "gemini",
  policyB: "allow" | "cap-size" | "halt" = "allow",
  scoreB = 92,
): VenueReliabilityOracle {
  return {
    generatedAt: Date.now(),
    summary: {
      venueCount: 3,
      healthyVenues: 1,
      cappedVenues: policyA === "cap-size" || policyB === "cap-size" ? 1 : 0,
      haltedVenues: [policyA, policyB].filter((policy) => policy === "halt").length,
      averageScore: 70,
      worstVenue: venueA as never,
      worstScore: scoreA,
      totalHaircutBps: 8,
      policy: "exclude-risky-venues",
    },
    venues: [
      venue(venueA, policyA, scoreA),
      venue(venueB, policyB, scoreB),
      venue("gemini", "allow", 94),
    ],
    equation: "test",
    sources: ["status"],
    errors: [],
  };
}

function venue(exchange: string, policy: "allow" | "cap-size" | "halt", score: number): VenueReliabilityOracle["venues"][number] {
  return {
    venue: exchange as never,
    label: exchange,
    indicator: policy === "halt" ? "critical" : policy === "cap-size" ? "minor" : "none",
    description: policy,
    updatedAt: Date.now(),
    fetchedAt: Date.now(),
    source: "status",
    operationalScore: score,
    statusPenaltyBps: policy === "halt" ? 18 : policy === "cap-size" ? 2 : 0,
    latencyPenaltyBps: 0,
    feedPenaltyBps: 0,
    totalHaircutBps: policy === "halt" ? 18 : policy === "cap-size" ? 2 : 0,
    policy,
    reasons: policy === "allow" ? [] : [`public status ${policy}`],
  };
}

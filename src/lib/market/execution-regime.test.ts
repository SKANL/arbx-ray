import { describe, expect, it } from "vitest";
import { buildExecutionRegimeFusion } from "./execution-regime";

describe("buildExecutionRegimeFusion", () => {
  it("fuses independent public signals into a simulate-execute regime", () => {
    const fusion = buildExecutionRegimeFusion({
      marketContext: { volatility: { realizedVolBpsPerSecond: 1.2 }, sentiment: { value: 55 }, sources: ["market"] },
      tradeTape: { summary: { combinedScore: 18, recommendation: "allow" }, sources: ["tape"] },
      derivativesPressure: { summary: { riskState: "normal", spotExecutionHaircutBps: 0.8, direction: "balanced" }, sources: ["perps"] },
      optionsIv: { summary: { regime: "calm", executionHaircutBps: 1.5, expectedMove1hBps: 12, atmIvPct: 18 }, sources: ["options"] },
      usdtBasis: { summary: { policy: "cross-lane-ok", dynamicHaircutBps: 3 }, sources: ["basis"] },
      priceConsensus: { summary: { confidence: "high", outlierCount: 0, staleCount: 0, maxPremiumBps: 8 }, sources: ["consensus"] },
      liquidityRadar: { summary: { executableRoutes: 5, routeCount: 20, bestNetProfitUsd: 42, sourceCount: 7 }, sources: ["liquidity"] },
      venueLatency: { summary: { medianP95Ms: 220 }, sources: ["latency"] },
      venueReliability: { summary: { policy: "allow-routing", averageScore: 94, haltedVenues: 0, cappedVenues: 0, totalHaircutBps: 0, worstVenue: "coinbase" }, sources: ["reliability"] },
      leadLag: { summary: { policy: "follow-leader", confidence: "high", executionHaircutBps: 1.2, leaderVenue: "coinbase", predictedDriftBps: 3.4, divergenceBps: 2.1 }, sources: ["lead-lag"] },
    });

    expect(fusion.action).toBe("simulate-execute");
    expect(fusion.score).toBeGreaterThanOrEqual(80);
    expect(fusion.combinedHaircutBps).toBeCloseTo(6.5);
    expect(fusion.factors).toHaveLength(10);
    expect(fusion.sources).toHaveLength(10);
  });

  it("halts when depeg, stale consensus, toxic flow, and high IV stack together", () => {
    const fusion = buildExecutionRegimeFusion({
      marketContext: { volatility: { realizedVolBpsPerSecond: 9 }, sentiment: { value: 18 } },
      tradeTape: { summary: { combinedScore: 86, recommendation: "halt" }, sources: ["tape"] },
      derivativesPressure: { summary: { riskState: "halt", spotExecutionHaircutBps: 18, direction: "long-crowded" }, sources: ["perps"] },
      optionsIv: { summary: { regime: "fragile", executionHaircutBps: 12, expectedMove1hBps: 95, atmIvPct: 91 }, sources: ["options"] },
      usdtBasis: { summary: { policy: "cross-lane-halt", dynamicHaircutBps: 55 }, sources: ["basis"] },
      priceConsensus: { summary: { confidence: "low", outlierCount: 2, staleCount: 1, maxPremiumBps: 180 }, sources: ["consensus"] },
      liquidityRadar: { summary: { executableRoutes: 0, routeCount: 18, bestNetProfitUsd: -120, sourceCount: 7 }, sources: ["liquidity"] },
      venueLatency: { summary: { medianP95Ms: 1800 }, sources: ["latency"] },
      venueReliability: { summary: { policy: "exclude-risky-venues", averageScore: 41, haltedVenues: 2, cappedVenues: 1, totalHaircutBps: 33, worstVenue: "coinbase" }, sources: ["reliability"] },
      leadLag: { summary: { policy: "halt", confidence: "low", executionHaircutBps: 24, leaderVenue: "binance", predictedDriftBps: -18, divergenceBps: 44 }, sources: ["lead-lag"] },
    });

    expect(fusion.action).toBe("halt");
    expect(fusion.score).toBeLessThan(35);
    expect(fusion.combinedHaircutBps).toBeGreaterThan(90);
    expect(fusion.hardStops).toContain("USDT cross-lane halt");
    expect(fusion.hardStops).toContain("Derivatives pressure halt");
    expect(fusion.hardStops).toContain("Lead-lag execution halt");
    expect(fusion.hardStops).toContain("Venue operational halt");
  });

  it("waits for evidence when too many independent signals are missing", () => {
    const fusion = buildExecutionRegimeFusion({
      marketContext: { volatility: { realizedVolBpsPerSecond: 2.5 } },
    });

    expect(fusion.action).toBe("wait-for-evidence");
    expect(fusion.sources).toHaveLength(0);
    expect(fusion.factors.some((factor) => factor.state === "missing")).toBe(true);
  });
});

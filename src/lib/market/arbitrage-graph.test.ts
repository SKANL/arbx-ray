import { describe, expect, it } from "vitest";
import { buildCrossVenueArbitrageGraph } from "./arbitrage-graph";
import type { LiquidityRadar } from "./liquidity-radar";
import type { MexicoCorridorLab } from "./mexico-corridor";
import type { TriangularLab } from "./triangular";

const liquidityRadar = {
  generatedAt: 1_780_000_000_000,
  targetSizeBtc: 0.3,
  books: [],
  routes: [
    {
      buyExchange: "coinbase",
      sellExchange: "kraken",
      quoteAsset: "USD",
      tradeSizeBtc: 0.3,
      complete: true,
      grossProfitUsd: 140,
      feeCostUsd: 48,
      rebalanceCostUsd: 12,
      latencyCostUsd: 8,
      netProfitUsd: 72,
      edgeBps: 34.29,
      buyVwap: 70_000,
      sellVwap: 70_466.67,
      routeScore: 86,
      rejectionReasons: [],
    },
    {
      buyExchange: "gemini",
      sellExchange: "coinbase",
      quoteAsset: "USD",
      tradeSizeBtc: 0.3,
      complete: false,
      grossProfitUsd: 20,
      feeCostUsd: 52,
      rebalanceCostUsd: 12,
      latencyCostUsd: 9,
      netProfitUsd: -53,
      edgeBps: -25.24,
      buyVwap: 70_200,
      sellVwap: 70_266.67,
      routeScore: 20,
      rejectionReasons: ["Negative net P&L"],
    },
  ],
  frontier: [],
  summary: {
    venuesLoaded: 3,
    usdVenues: 3,
    usdtVenues: 0,
    routeCount: 2,
    executableRoutes: 1,
    bestNetProfitUsd: 72,
    medianSpreadBps: 3,
    sourceCount: 3,
  },
  sources: ["coinbase-depth", "kraken-depth", "gemini-depth"],
  errors: [],
} as LiquidityRadar;

const triangularLab = {
  generatedAt: 1_780_000_000_000,
  venue: "coinbase",
  startUsd: 10_000,
  feeBps: 60,
  routes: [
    {
      id: "usd-btc-eth-usd",
      label: "USD -> BTC -> ETH -> USD",
      startUsd: 10_000,
      finalUsd: 10_120,
      grossPnlUsd: 120,
      netPnlUsd: 120,
      netPnlBps: 120,
      complete: true,
      rejectionReasons: [],
      explanation: "fixture",
      legs: [
        {
          action: "buy",
          pair: "BTC-USD",
          inputAsset: "USD",
          outputAsset: "BTC",
          inputAmount: 10_000,
          outputAmount: 0.142,
          feeAmount: 0.00086,
          vwap: 70_000,
          complete: true,
          levelsUsed: 2,
        },
        {
          action: "buy",
          pair: "ETH-BTC",
          inputAsset: "BTC",
          outputAsset: "ETH",
          inputAmount: 0.142,
          outputAmount: 2.82,
          feeAmount: 0.017,
          vwap: 0.05,
          complete: true,
          levelsUsed: 2,
        },
        {
          action: "sell",
          pair: "ETH-USD",
          inputAsset: "ETH",
          outputAsset: "USD",
          inputAmount: 2.82,
          outputAmount: 10_120,
          feeAmount: 61,
          vwap: 3_610,
          complete: true,
          levelsUsed: 2,
        },
      ],
    },
  ],
  bestRoute: undefined,
  books: {},
  sources: ["coinbase-triangular-books"],
  errors: [],
} as unknown as TriangularLab;

const mexicoCorridor = {
  generatedAt: 1_780_000_000_000,
  targetSizeBtc: 0.25,
  routes: [
    {
      id: "coinbase-usd-to-bitso-mxn",
      label: "Coinbase USD -> Bitso MXN -> USD",
      tradeSizeBtc: 0.25,
      startUsd: 17_500,
      finalUsd: 17_665,
      grossEdgeUsd: 165,
      feeCostUsd: 72,
      rebalanceCostUsd: 20,
      netPnlUsd: 145,
      netPnlBps: 82.86,
      complete: true,
      routeScore: 91,
      rejectionReasons: [],
      explanation: "fixture",
      legs: [
        {
          venue: "coinbase",
          pair: "BTC-USD",
          action: "buy-btc",
          inputAsset: "USD",
          outputAsset: "BTC",
          inputAmount: 17_500,
          outputAmount: 0.249,
          feeAmount: 0.0015,
          vwap: 70_000,
          complete: true,
          levelsUsed: 1,
        },
        {
          venue: "bitso",
          pair: "btc_mxn",
          action: "sell-btc",
          inputAsset: "BTC",
          outputAsset: "MXN",
          inputAmount: 0.249,
          outputAmount: 331_200,
          feeAmount: 2_160,
          vwap: 1_335_000,
          complete: true,
          levelsUsed: 1,
        },
        {
          venue: "bitso",
          pair: "usd_mxn",
          action: "buy-usd",
          inputAsset: "MXN",
          outputAsset: "USD",
          inputAmount: 331_200,
          outputAmount: 17_665,
          feeAmount: 88,
          vwap: 18.65,
          complete: true,
          levelsUsed: 1,
        },
      ],
    },
  ],
  bestRoute: undefined,
  books: {},
  summary: {
    executableRoutes: 1,
    bestNetPnlUsd: 145,
    bestRouteLabel: "Coinbase USD -> Bitso MXN -> USD",
    impliedUsdMxnBid: 18.6,
    impliedUsdMxnAsk: 18.7,
  },
  assumptions: { coinbaseFeeBps: 60, bitsoFeeBps: 65, fxFeeBps: 50, rebalanceCostUsd: 20 },
  sources: ["bitso-books", "coinbase-book"],
  errors: [],
} as unknown as MexicoCorridorLab;

describe("buildCrossVenueArbitrageGraph", () => {
  it("turns public route evidence into negative-cycle arbitrage proof", () => {
    const graph = buildCrossVenueArbitrageGraph({
      liquidityRadar,
      triangularLab,
      mexicoCorridor,
      generatedAt: 1_780_000_000_000,
    });

    expect(graph.summary.policy).toBe("execute-cycle");
    expect(graph.nodes.length).toBeGreaterThanOrEqual(6);
    expect(graph.edges.length).toBeGreaterThanOrEqual(8);
    expect(graph.summary.hasNegativeCycle).toBe(true);
    expect(graph.cycles[0]?.label).toContain("Coinbase USD -> Bitso");
    expect(graph.cycles[0]?.netPnlUsd).toBe(145);
    expect(graph.cycles[0]?.negativeWeight).toBeLessThan(0);
    expect(graph.cycles[0]?.edges.every((edge) => edge.weight === -Math.log(edge.rate))).toBe(true);
    expect(graph.equation).toContain("-log(rate_after_costs)");
  });

  it("keeps no-cycle policy when every candidate fails costs or depth", () => {
    const graph = buildCrossVenueArbitrageGraph({
      liquidityRadar: {
        ...liquidityRadar,
        routes: liquidityRadar.routes.map((route) => ({
          ...route,
          complete: false,
          netProfitUsd: -20,
          rejectionReasons: ["Negative net P&L"],
        })),
      },
      triangularLab: {
        ...triangularLab,
        routes: triangularLab.routes.map((route) => ({
          ...route,
          finalUsd: 9_980,
          netPnlUsd: -20,
          netPnlBps: -20,
          rejectionReasons: ["Negative net triangular expectancy"],
        })),
      },
    });

    expect(graph.summary.policy).toBe("no-cycle");
    expect(graph.summary.hasNegativeCycle).toBe(false);
    expect(graph.cycles).toHaveLength(0);
    expect(graph.reasons).toContain("No profitable complete cycle survived fees, depth, and rebalance costs.");
  });
});

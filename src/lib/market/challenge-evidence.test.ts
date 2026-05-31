import { describe, expect, it } from "vitest";
import { buildChallengeEvidence, buildDecisionAuditReceipt } from "./challenge-evidence";
import type { CrossVenueArbitrageGraph } from "./arbitrage-graph";
import type { CausalExecutionGraph } from "./causal-execution-graph";
import type { ConformalExecutionGuard } from "./conformal-execution-guard";
import type { MarketContext } from "./context";
import type { ExecutionTournament } from "./execution-tournament";
import type { HawkesFlowShockOracle } from "./hawkes-flow";
import type { HistoricalReplay } from "./historical";
import type { LiquidityMirageDetector } from "./liquidity-mirage";
import type { OptimalStoppingFrontier } from "./optimal-stopping-frontier";
import type { BayesianRegimeBreakLab } from "./regime-break";
import type { RiskGovernor } from "./risk-governor";
import type { SequentialExecutionTest } from "./sequential-execution-test";
import type { JudgeScorecard, StressResult } from "./stress";
import type { FeedHealth, OpportunityDecision } from "./types";
import type { VenueIntelligence } from "./venue-intelligence";

const decision: OpportunityDecision = {
  id: "audit-1",
  status: "accepted",
  buyExchange: "kraken",
  sellExchange: "coinbase",
  quoteAsset: "USD",
  observedAt: 1_780_000_000_000,
  tradeSizeBtc: 0.5,
  grossProfitUsd: 420,
  netProfitUsd: 132,
  buyFill: { filledBtc: 0.5, notional: 35_000, vwap: 70_000, complete: true, levelsUsed: [] },
  sellFill: { filledBtc: 0.5, notional: 35_420, vwap: 70_840, complete: true, levelsUsed: [] },
  impactCurve: [
    { sizeBtc: 0.1, grossProfitUsd: 84, netProfitUsd: 22, buyVwap: 70_000, sellVwap: 70_840, accepted: true },
  ],
  microstructure: {
    buy: { midPrice: 70_010, spreadUsd: 12, spreadBps: 1.7, imbalance: 0.25, microprice: 70_014, pressure: "bid" },
    sell: { midPrice: 70_820, spreadUsd: 16, spreadBps: 2.2, imbalance: -0.2, microprice: 70_817, pressure: "ask" },
  },
  rejectionReasons: [],
  risk: {
    score: 91,
    latencyPenaltyUsd: 18,
    feeCostUsd: 260,
    withdrawalCostUsd: 10,
    grossProfitUsd: 420,
    positivePnlProbability: 0.87,
    reasons: ["Same quote lane: USD"],
  },
  explanation: "net = gross - fees - withdrawal - latency",
};

const governor: RiskGovernor = {
  state: "normal",
  score: 94,
  action: "Execution policy allows normal simulated sizing.",
  rules: [],
};

const scorecard: JudgeScorecard = {
  speed: 92,
  precision: 90,
  robustness: 88,
  strategy: 89,
  presentation: 92,
  overall: 90,
  bullets: [],
};

const stressResults: StressResult[] = [
  { id: "normal", label: "Observed", stressedNetProfitUsd: 132, stressedProbability: 0.87, survives: true, explanation: "base" },
  { id: "slow", label: "Slow", stressedNetProfitUsd: 51, stressedProbability: 0.68, survives: true, explanation: "slow" },
];

const context: MarketContext = {
  fetchedAt: 1,
  volatility: { source: "kraken-ohlc", intervalSeconds: 60, realizedVolBpsPerSecond: 3.2, closes: [1, 2, 3] },
  sources: ["kraken", "mempool"],
  errors: [],
};

const historicalReplay = {
  candles: { aligned: 120 },
  statArb: { regime: "mean-reverting", latestZScore: 1.4 },
  sources: ["coinbase-candles"],
} as HistoricalReplay;

const venueIntelligence = {
  summary: { venuesTracked: 6 },
  sources: ["coingecko"],
} as VenueIntelligence;

const health: FeedHealth[] = [
  { exchangeId: "kraken", status: "live", latencyMs: 44 },
  { exchangeId: "coinbase", status: "live", latencyMs: 63 },
];

const causalExecutionGraph = {
  generatedAt: 1_780_000_000_000,
  nodes: [
    { id: "market-edge", label: "Market edge", group: "market", state: "support", score: 88, evidence: "fixture" },
    { id: "edge-conviction", label: "Bayesian conviction", group: "validation", state: "support", score: 82, evidence: "fixture" },
    { id: "walk-forward", label: "Walk-forward validation", group: "validation", state: "support", score: 81, evidence: "fixture" },
    { id: "latency-race", label: "Latency alpha race", group: "execution", state: "support", score: 76, evidence: "fixture" },
    { id: "risk-governor", label: "Risk governor", group: "risk", state: "support", score: 94, evidence: "fixture" },
    { id: "execution-playbook", label: "Autonomous playbook", group: "decision", state: "support", score: 88, evidence: "fixture" },
    { id: "final-decision", label: "Final simulated decision", group: "decision", state: "support", score: 84, evidence: "execute-simulated" },
  ],
  edges: [],
  rejectionReasons: [],
  summary: {
    finalDecision: "execute-simulated",
    supportScore: 84,
    dragScore: 0,
    blockerCount: 0,
    explanation: "fixture",
  },
  equation: "fixture",
} as CausalExecutionGraph;

const liquidityMirage = {
  generatedAt: 1_780_000_000_000,
  buy: {} as LiquidityMirageDetector["buy"],
  sell: {} as LiquidityMirageDetector["sell"],
  riskFactors: [
    { id: "partial-fill", label: "Fill completeness", state: "pass", value: 100, threshold: 100, unit: "pct", explanation: "fixture" },
  ],
  reasons: ["visible depth supports the executable edge"],
  summary: {
    policy: "allow",
    mirageScore: 12,
    executableEdgeRetainedPct: 88,
    depthConvexityBps: 4,
    topOfBookEdgeBps: 60,
    vwapEdgeBps: 53,
    concentrationPct: 44,
    smartRouterConfirmation: 86,
  },
  equation: "fixture",
} as LiquidityMirageDetector;

const hawkesFlowShock = {
  generatedAt: 1_780_000_000_000,
  venues: [
    {
      exchangeId: "coinbase",
      state: "benign",
      branchingRatio: 0.18,
      baselineIntensityPerSecond: 0.2,
      excitedIntensityPerSecond: 0.24,
      aftershockProbability: 0.21,
      expectedShockBtc: 0.03,
      signedPressure: "balanced",
      evidence: "fixture",
    },
  ],
  reasons: ["recent aggressor flow is not self-exciting"],
  summary: {
    policy: "allow",
    branchingRatio: 0.18,
    aftershockProbability: 0.21,
    expectedShockBtc: 0.03,
    shockHalfLifeSeconds: 1.1,
    topDepthCoveragePct: 6,
    sourceCount: 1,
  },
  equation: "fixture",
} as HawkesFlowShockOracle;

const sequentialExecutionTest = {
  generatedAt: 1_780_000_000_000,
  alpha: 0.08,
  beta: 0.12,
  upperBoundary: 2.3979,
  lowerBoundary: -2.0369,
  steps: [
    { id: "market", label: "Market edge", logLikelihood: 1.2, cumulativeLogLikelihood: 1.2, direction: "supports-execution", evidence: "fixture" },
    { id: "bayes", label: "Bayesian conviction", logLikelihood: 0.7, cumulativeLogLikelihood: 1.9, direction: "supports-execution", evidence: "fixture" },
    { id: "latency", label: "Latency race", logLikelihood: 0.6, cumulativeLogLikelihood: 2.5, direction: "supports-execution", evidence: "fixture" },
    { id: "hawkes", label: "Hawkes flow", logLikelihood: 0.3, cumulativeLogLikelihood: 2.8, direction: "supports-execution", evidence: "fixture" },
    { id: "mirage", label: "Liquidity mirage", logLikelihood: 0.4, cumulativeLogLikelihood: 3.2, direction: "supports-execution", evidence: "fixture" },
    { id: "risk", label: "Risk governor", logLikelihood: 0.5, cumulativeLogLikelihood: 3.7, direction: "supports-execution", evidence: "fixture" },
  ],
  summary: {
    decision: "accept-execute",
    finalLogLikelihood: 3.7,
    confidencePct: 97.6,
    falseExecuteRiskPct: 8,
    falseRejectRiskPct: 12,
    evidenceCount: 6,
    strongestSupport: "Market edge",
  },
  reasons: ["SPRT upper boundary crossed"],
  equation: "fixture",
} as SequentialExecutionTest;

const executionTournament = {
  generatedAt: 1_780_000_000_000,
  contestants: [
    { id: "arbx-ray-autopilot", label: "ArbX-Ray autopilot", action: "deploy", score: 94, totalPnlUsd: 160, regretUsd: 0, regretPct: 0, exploitabilityScore: 0, tradeCount: 5, winRate: 0.9, maxDrawdownUsd: 4, robustnessScore: 92, thesis: "fixture", evidence: [] },
    { id: "naive-spread-chaser", label: "Naive", action: "deploy", score: 60, totalPnlUsd: 90, regretUsd: 70, regretPct: 0.43, exploitabilityScore: 43, tradeCount: 8, winRate: 0.55, maxDrawdownUsd: 40, robustnessScore: 51, thesis: "fixture", evidence: [] },
    { id: "balanced", label: "Balanced", action: "deploy", score: 76, totalPnlUsd: 120, regretUsd: 40, regretPct: 0.25, exploitabilityScore: 25, tradeCount: 4, winRate: 0.8, maxDrawdownUsd: 8, robustnessScore: 78, thesis: "fixture", evidence: [] },
    { id: "walk-forward", label: "Walk-forward", action: "deploy", score: 82, totalPnlUsd: 138, regretUsd: 22, regretPct: 0.14, exploitabilityScore: 14, tradeCount: 3, winRate: 0.9, maxDrawdownUsd: 3, robustnessScore: 86, thesis: "fixture", evidence: [] },
  ],
  summary: {
    policy: "ship-autopilot",
    championId: "arbx-ray-autopilot",
    championLabel: "ArbX-Ray autopilot",
    arbxRank: 1,
    arbxRegretUsd: 0,
    bestPnlUsd: 160,
    averageRegretUsd: 33,
    exploitabilityScore: 0,
  },
  reasons: ["fixture"],
  equation: "fixture",
} as ExecutionTournament;

const arbitrageGraph = {
  generatedAt: 1_780_000_000_000,
  nodes: [
    { id: "coinbase:USD", label: "Coinbase USD", asset: "USD", venue: "coinbase", kind: "venue" },
    { id: "coinbase:BTC", label: "Coinbase BTC", asset: "BTC", venue: "coinbase", kind: "venue" },
    { id: "bitso:MXN", label: "Bitso MXN", asset: "MXN", venue: "bitso", kind: "venue" },
    { id: "bitso:USD", label: "Bitso USD", asset: "USD", venue: "bitso", kind: "venue" },
  ],
  edges: [],
  cycles: [],
  summary: {
    policy: "execute-cycle",
    nodeCount: 4,
    edgeCount: 4,
    cycleCount: 1,
    bestCyclePnlUsd: 145,
    bestCycleBps: 82,
    bestCycleLabel: "Mexico corridor",
    hasNegativeCycle: true,
    proofScore: 94,
  },
  reasons: ["Bellman-Ford detected at least one negative-weight cycle."],
  equation: "w=-log(rate_after_costs)",
} as CrossVenueArbitrageGraph;

const regimeBreakLab = {
  generatedAt: 1_780_000_000_000,
  observations: [{ index: 1, timestamp: 1, spreadBps: 10, netProfitUsd: 12, runLength: 8, breakProbability: 0.08, predictiveMeanBps: 9, predictiveSigmaBps: 2 }],
  changepoints: [],
  summary: {
    policy: "trust-history",
    sampleCount: 32,
    hazardRate: 0.06,
    latestBreakProbability: 0.08,
    latestRunLength: 18,
    regimeShiftBps: 0,
    expectedEdgeDecayBps: 0,
    posteriorTrustScore: 94,
  },
  reasons: ["Historical spread distribution is stable enough for walk-forward evidence to remain usable."],
  equation: "P(change_t | x_1:t)",
  sources: ["kraken-candles", "coinbase-candles"],
} as BayesianRegimeBreakLab;

const conformalGuard = {
  summary: {
    policy: "execute",
    targetCoverage: 0.9,
    sampleCount: 40,
    quantileResidualUsd: 18,
    expectedNetUsd: 132,
    lowerBoundUsd: 114,
    recommendedSizeBtc: 0.5,
    coverageScore: 91,
    tailHitRate: 0.08,
  },
  calibration: [],
  reasons: ["90% conformal lower bound remains positive"],
  equation: "lower_bound = expected_net - conformal_quantile(residuals)",
  sources: ["split-conformal"],
} as ConformalExecutionGuard;

const optimalStoppingFrontier = {
  generatedAt: 1_780_000_000_000,
  frontier: [
    { horizonMs: 0, survivalProbability: 1, decayedEdgeUsd: 132, optionValueUsd: 0, volatilityCostUsd: 0, conformalPenaltyUsd: 18, expectedValueUsd: 114 },
    { horizonMs: 250, survivalProbability: 0.8, decayedEdgeUsd: 105, optionValueUsd: 2, volatilityCostUsd: 4, conformalPenaltyUsd: 18.2, expectedValueUsd: 84.8 },
  ],
  summary: {
    policy: "execute-now",
    bestHorizonMs: 0,
    immediateValueUsd: 114,
    bestExpectedValueUsd: 114,
    optionValueUsd: 0,
    recommendedSizeBtc: 0.5,
    stoppingScore: 92,
  },
  reasons: ["immediate crossing maximizes expected value"],
  equation: "EV(wait_t)",
  sources: ["optimal-stopping"],
} as OptimalStoppingFrontier;

describe("buildDecisionAuditReceipt", () => {
  it("builds a stable fingerprint from decision, policy, and context inputs", () => {
    const first = buildDecisionAuditReceipt({
      decision,
      governor,
      marketContext: context,
      historicalReplay,
      sourceCount: 4,
    });
    const second = buildDecisionAuditReceipt({
      decision,
      governor,
      marketContext: context,
      historicalReplay,
      sourceCount: 4,
    });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.route).toContain("KRAKEN");
    expect(first.formulaRows.find((row) => row.label === "Final net P&L")?.value).toBe(132);
    expect(first.policyRows.some((row) => row.value.includes("mean-reverting"))).toBe(true);
  });
});

describe("buildChallengeEvidence", () => {
  it("summarizes challenge readiness, demo path, and source evidence", () => {
    const evidence = buildChallengeEvidence({
      decision,
      scorecard,
      governor,
      stressResults,
      marketContext: context,
      historicalReplay,
      venueIntelligence,
      causalExecutionGraph,
      hawkesFlowShock,
      liquidityMirage,
      sequentialExecutionTest,
      executionTournament,
      arbitrageGraph,
      regimeBreakLab,
      conformalGuard,
      optimalStoppingFrontier,
      triangularLab: { routes: [{ id: "usd-btc-eth-usd" }], sources: ["coinbase-books"] } as never,
      liveBooks: 2,
      enabledVenues: 2,
      health,
      recent: [decision, { ...decision, id: "reject", status: "rejected", rejectionReasons: ["Negative net expectancy"] }],
      trades: [],
    });

    expect(evidence.readinessScore).toBeGreaterThanOrEqual(88);
    expect(evidence.verdict).toBe("national-final-ready");
    expect(evidence.criteria).toHaveLength(6);
    expect(evidence.demoSteps.map((step) => step.view)).toContain("triangular");
    expect(evidence.demoSteps.map((step) => step.id)).toContain("causal-execution-graph");
    expect(evidence.demoSteps.map((step) => step.id)).toContain("liquidity-mirage");
    expect(evidence.demoSteps.map((step) => step.id)).toContain("hawkes-flow-shock");
    expect(evidence.demoSteps.map((step) => step.id)).toContain("sequential-execution-test");
    expect(evidence.demoSteps.map((step) => step.id)).toContain("execution-tournament");
    expect(evidence.demoSteps.map((step) => step.id)).toContain("arbitrage-graph");
    expect(evidence.demoSteps.map((step) => step.id)).toContain("regime-break");
    expect(evidence.demoSteps.map((step) => step.id)).toContain("conformal-execution-guard");
    expect(evidence.demoSteps.map((step) => step.id)).toContain("optimal-stopping-frontier");
    expect(evidence.criteria.find((criterion) => criterion.id === "strategy")?.proof).toContain("SPRT accept-execute");
    expect(evidence.criteria.find((criterion) => criterion.id === "strategy")?.proof).toContain("tournament ship-autopilot");
    expect(evidence.criteria.find((criterion) => criterion.id === "strategy")?.proof).toContain("arbitrage graph execute-cycle");
    expect(evidence.criteria.find((criterion) => criterion.id === "strategy")?.proof).toContain("regime break trust-history");
    expect(evidence.criteria.find((criterion) => criterion.id === "strategy")?.proof).toContain("conformal guard execute");
    expect(evidence.criteria.find((criterion) => criterion.id === "strategy")?.proof).toContain("optimal stopping execute-now");
    expect(evidence.criteria.find((criterion) => criterion.id === "architecture")?.proof).toContain("23 Next.js Route Handler backend modules");
    expect(evidence.demoSteps.find((step) => step.id === "backend-evidence")?.kpi).toBe("23 serverless API modules");
    expect(evidence.decisionReceipt?.fingerprint).toMatch(/^arbx-/);
    expect(evidence.sourceCount).toBe(8);
  });
});

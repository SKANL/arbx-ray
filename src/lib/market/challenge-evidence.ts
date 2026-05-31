import type { MarketContext } from "./context";
import type { CrossVenueArbitrageGraph } from "./arbitrage-graph";
import type { CapitalAllocationOptimizer } from "./capital-allocation";
import type { CashCarryLab } from "./cash-carry";
import type { CausalExecutionGraph } from "./causal-execution-graph";
import type { ConformalExecutionGuard } from "./conformal-execution-guard";
import type { DerivativesPressureOracle } from "./derivatives-pressure";
import type { ExecutionRegimeFusion } from "./execution-regime";
import type { ExecutionPlaybook } from "./execution-playbook";
import type { ExecutionTournament } from "./execution-tournament";
import type { HawkesFlowShockOracle } from "./hawkes-flow";
import type { HistoricalReplay } from "./historical";
import type { LatencyAlphaRace } from "./latency-alpha-race";
import type { LeadLagOracle } from "./lead-lag";
import type { LiquidityMirageDetector } from "./liquidity-mirage";
import type { LiquidityRadar } from "./liquidity-radar";
import type { LiquidityTopologyMap } from "./liquidity-topology";
import type { MexicoCorridorLab } from "./mexico-corridor";
import type { OptionsIvOracle } from "./options-iv";
import type { OptimalStoppingFrontier } from "./optimal-stopping-frontier";
import type { OpportunityHeatmap } from "./opportunity-heatmap";
import type { PriceConsensusOracle } from "./price-consensus";
import type { QueuePositionOracle } from "./queue-position";
import type { BayesianRegimeBreakLab } from "./regime-break";
import type { RiskGovernor } from "./risk-governor";
import type { SettlementRiskOracle } from "./settlement-risk";
import type { SequentialExecutionTest } from "./sequential-execution-test";
import type { SmartOrderRouterPlan } from "./smart-order-router";
import type { JudgeScorecard, StressResult } from "./stress";
import type { TriangularLab } from "./triangular";
import type { FeedHealth, OpportunityDecision, TradeEvent } from "./types";
import type { UsdtBasisOracle } from "./usdt-basis";
import type { VenueFailureWarGame } from "./venue-failure";
import type { VenueLatencyRace } from "./venue-latency";
import type { VenueReliabilityOracle } from "./venue-reliability";
import type { VenueIntelligence } from "./venue-intelligence";
import type { WalkForwardRobustness } from "./walk-forward";

const BACKEND_MODULE_COUNT = 23;

export type DashboardView =
  | "cockpit"
  | "quant"
  | "market"
  | "backend"
  | "mexico"
  | "triangular"
  | "backtest"
  | "judge"
  | "replay";

export type ChallengeCriterionId =
  | "speed"
  | "precision"
  | "robustness"
  | "strategy"
  | "architecture"
  | "presentation";

export type ChallengeCriterionEvidence = {
  id: ChallengeCriterionId;
  label: string;
  score: number;
  status: "strong" | "watch" | "gap";
  proof: string;
  nextMove: string;
};

export type DemoStep = {
  id: string;
  view: DashboardView;
  label: string;
  timeboxSeconds: number;
  kpi: string;
  proof: string;
};

export type DecisionAuditReceipt = {
  fingerprint: string;
  decisionId: string;
  status: OpportunityDecision["status"];
  route: string;
  observedAt: number;
  formulaRows: Array<{ label: string; value: number; unit: "USD" | "BTC" | "probability" | "score" }>;
  policyRows: Array<{ label: string; value: string }>;
  rejectionReasons: string[];
  provenance: string[];
};

export type ChallengeEvidence = {
  readinessScore: number;
  verdict: "national-final-ready" | "demo-ready" | "needs-live-evidence";
  criteria: ChallengeCriterionEvidence[];
  demoSteps: DemoStep[];
  decisionReceipt?: DecisionAuditReceipt;
  sourceCount: number;
  gaps: string[];
};

export function buildChallengeEvidence(input: {
  decision?: OpportunityDecision;
  scorecard: JudgeScorecard;
  governor: RiskGovernor;
  stressResults: StressResult[];
  marketContext?: MarketContext;
  cashCarryLab?: CashCarryLab;
  settlementRisk?: SettlementRiskOracle;
  historicalReplay?: HistoricalReplay;
  derivativesPressure?: DerivativesPressureOracle;
  venueIntelligence?: VenueIntelligence;
  liquidityRadar?: LiquidityRadar;
  mexicoCorridor?: MexicoCorridorLab;
  optionsIv?: OptionsIvOracle;
  priceConsensus?: PriceConsensusOracle;
  usdtBasis?: UsdtBasisOracle;
  venueLatency?: VenueLatencyRace;
  leadLag?: LeadLagOracle;
  venueReliability?: VenueReliabilityOracle;
  venueFailureWarGame?: VenueFailureWarGame;
  smartOrderRouter?: SmartOrderRouterPlan;
  queuePosition?: QueuePositionOracle;
  latencyAlphaRace?: LatencyAlphaRace;
  hawkesFlowShock?: HawkesFlowShockOracle;
  liquidityMirage?: LiquidityMirageDetector;
  liquidityTopology?: LiquidityTopologyMap;
  opportunityHeatmap?: OpportunityHeatmap;
  walkForwardRobustness?: WalkForwardRobustness;
  regimeBreakLab?: BayesianRegimeBreakLab;
  conformalGuard?: ConformalExecutionGuard;
  optimalStoppingFrontier?: OptimalStoppingFrontier;
  executionPlaybook?: ExecutionPlaybook;
  causalExecutionGraph?: CausalExecutionGraph;
  sequentialExecutionTest?: SequentialExecutionTest;
  executionTournament?: ExecutionTournament;
  executionRegime?: ExecutionRegimeFusion;
  capitalOptimizer?: CapitalAllocationOptimizer;
  arbitrageGraph?: CrossVenueArbitrageGraph;
  triangularLab?: TriangularLab;
  liveBooks: number;
  enabledVenues: number;
  health: FeedHealth[];
  recent: OpportunityDecision[];
  trades: TradeEvent[];
}): ChallengeEvidence {
  const sourceCount = uniqueStrings([
    ...(input.marketContext?.sources ?? []),
    ...(input.cashCarryLab?.sources ?? []),
    ...(input.settlementRisk?.sources ?? []),
    ...(input.derivativesPressure?.sources ?? []),
    ...(input.historicalReplay?.sources ?? []),
    ...(input.venueIntelligence?.sources ?? []),
    ...(input.liquidityRadar?.sources ?? []),
    ...(input.liquidityTopology?.sources ?? []),
    ...(input.mexicoCorridor?.sources ?? []),
    ...(input.optionsIv?.sources ?? []),
    ...(input.priceConsensus?.sources ?? []),
    ...(input.usdtBasis?.sources ?? []),
    ...(input.venueLatency?.sources ?? []),
    ...(input.leadLag?.sources ?? []),
    ...(input.venueReliability?.sources ?? []),
    ...(input.executionRegime?.sources ?? []),
    ...(input.regimeBreakLab?.sources ?? []),
    ...(input.conformalGuard?.sources ?? []),
    ...(input.optimalStoppingFrontier?.sources ?? []),
    ...(input.triangularLab?.sources ?? []),
  ]).length;
  const rejectedCount = input.recent.filter((decision) => decision.status === "rejected").length;
  const stressSurvival =
    input.stressResults.length > 0
      ? input.stressResults.filter((result) => result.survives).length / input.stressResults.length
      : 0;
  const healthyFeeds = input.health.filter((feed) => feed.status === "live").length;
  const maxLatencyMs = Math.max(0, ...input.health.map((feed) => feed.latencyMs || 0));
  const externalFastest = input.venueLatency?.summary.fastestVenue ?? "not measured";
  const externalMedianP95 = input.venueLatency?.summary.medianP95Ms ?? 0;
  const hasHistorical = Boolean(input.historicalReplay && input.historicalReplay.candles.aligned > 20);
  const hasCashCarry = Boolean(input.cashCarryLab && input.cashCarryLab.routes.length >= 3);
  const hasSettlementRisk = Boolean(input.settlementRisk && input.settlementRisk.summary.projectedBlocks > 0);
  const hasDerivativesPressure = Boolean(input.derivativesPressure && input.derivativesPressure.summary.sourceCount >= 2);
  const hasTriangular = Boolean(input.triangularLab?.routes.length);
  const hasVenueMap = Boolean(input.venueIntelligence && input.venueIntelligence.summary.venuesTracked >= 3);
  const hasLiquidityRadar = Boolean(input.liquidityRadar && input.liquidityRadar.summary.venuesLoaded >= 3);
  const hasMexicoCorridor = Boolean(input.mexicoCorridor && input.mexicoCorridor.routes.length >= 2);
  const hasOptionsIv = Boolean(input.optionsIv && input.optionsIv.summary.selectedCount >= 2);
  const hasConsensus = Boolean(input.priceConsensus && input.priceConsensus.summary.venueCount >= 3);
  const hasUsdtBasis = Boolean(input.usdtBasis && input.usdtBasis.summary.sourceCount >= 3);
  const hasExecutionRegime = Boolean(input.executionRegime && input.executionRegime.confidence !== "low");
  const hasCapitalOptimizer = Boolean(input.capitalOptimizer && input.capitalOptimizer.allocations.length >= 3);
  const hasLeadLag = Boolean(input.leadLag && input.leadLag.summary.venueCount >= 2);
  const hasVenueReliability = Boolean(input.venueReliability && input.venueReliability.summary.venueCount >= 2);
  const hasVenueFailureWarGame = Boolean(input.venueFailureWarGame && input.venueFailureWarGame.scenarios.length >= 2);
  const hasSmartRouter = Boolean(input.smartOrderRouter && input.smartOrderRouter.summary.tradeSizeBtc > 0);
  const hasQueuePosition = Boolean(input.queuePosition && input.queuePosition.summary.takerNetUsd !== 0);
  const hasLatencyAlphaRace = Boolean(input.latencyAlphaRace && input.latencyAlphaRace.summary.edgeHalfLifeMs > 0);
  const hasHawkesFlowShock = Boolean(input.hawkesFlowShock && input.hawkesFlowShock.venues.length > 0);
  const hasLiquidityMirage = Boolean(input.liquidityMirage && input.liquidityMirage.riskFactors.length > 0);
  const hasLiquidityTopology = Boolean(input.liquidityTopology && input.liquidityTopology.summary.venueCount >= 2);
  const hasOpportunityHeatmap = Boolean(input.opportunityHeatmap && input.opportunityHeatmap.summary.opportunityCount > 0);
  const hasWalkForward = Boolean(input.walkForwardRobustness && input.walkForwardRobustness.summary.policy !== "insufficient-history");
  const hasRegimeBreak = Boolean(input.regimeBreakLab && input.regimeBreakLab.summary.policy !== "insufficient-history");
  const hasConformalGuard = Boolean(input.conformalGuard && input.conformalGuard.summary.policy !== "insufficient-history");
  const hasOptimalStopping = Boolean(input.optimalStoppingFrontier && input.optimalStoppingFrontier.summary.policy !== "wait-for-edge");
  const hasExecutionPlaybook = Boolean(input.executionPlaybook && input.executionPlaybook.actions.length >= 3);
  const hasCausalExecutionGraph = Boolean(input.causalExecutionGraph && input.causalExecutionGraph.nodes.length >= 6);
  const hasSequentialExecutionTest = Boolean(input.sequentialExecutionTest && input.sequentialExecutionTest.steps.length >= 6);
  const hasExecutionTournament = Boolean(input.executionTournament && input.executionTournament.contestants.length >= 4);
  const hasArbitrageGraph = Boolean(input.arbitrageGraph && input.arbitrageGraph.summary.nodeCount >= 4);
  const hasReceipt = Boolean(input.decision);

  const criteria: ChallengeCriterionEvidence[] = [
    criterion({
      id: "speed",
      label: "Real-time detection speed",
      score: input.scorecard.speed,
      proof: `${input.liveBooks}/${input.enabledVenues} selected books active; ${healthyFeeds} feeds live; WS worst ${Math.round(maxLatencyMs)}ms; REST race fastest ${externalFastest}, median p95 ${Math.round(externalMedianP95)}ms.`,
      nextMove: "Use Venue Latency Race plus Replay if a venue blocks local WebSocket access during judging.",
    }),
    criterion({
      id: "precision",
      label: "Net profitability precision",
      score: input.scorecard.precision,
      proof: input.decision
        ? `Latest route calculates gross ${round(input.decision.grossProfitUsd)} USD, net ${round(input.decision.netProfitUsd)} USD, P(win) ${(input.decision.risk.positivePnlProbability * 100).toFixed(1)}%, and liquidity mirage ${input.liquidityMirage?.summary.policy ?? "not loaded"}; derivatives pressure ${input.derivativesPressure?.summary.riskState ?? "not loaded"}.`
        : `Waiting for a live or replay route before showing the full net formula; options IV regime ${input.optionsIv?.summary.regime ?? "not loaded"}.`,
      nextMove: "Generate a route and open the audit receipt to show every cost term.",
    }),
    criterion({
      id: "robustness",
      label: "Risk and failure handling",
      score: Math.round((input.scorecard.robustness + input.governor.score + stressSurvival * 100) / 3),
      proof: `${Math.round(stressSurvival * 100)}% stress survival; governor state is ${input.governor.state}; ${rejectedCount} rejected events explain why raw spreads fail.`,
      nextMove: "Keep rejection reasons visible; judges need to see non-execution discipline.",
    }),
    criterion({
      id: "strategy",
      label: "Bot intelligence",
      score: clampScore(
        input.scorecard.strategy +
          (hasHistorical ? 4 : 0) +
          (hasCashCarry ? 5 : 0) +
          (hasSettlementRisk ? 4 : 0) +
          (hasDerivativesPressure ? 3 : 0) +
          (hasTriangular ? 4 : 0) +
          (hasVenueMap ? 3 : 0) +
          (hasLiquidityRadar ? 3 : 0) +
          (hasMexicoCorridor ? 5 : 0) +
          (hasOptionsIv ? 3 : 0) +
          (hasConsensus ? 3 : 0) +
          (hasUsdtBasis ? 3 : 0) +
          (hasExecutionRegime ? 4 : 0) +
          (hasCapitalOptimizer ? 4 : 0) +
          (hasLeadLag ? 4 : 0) +
          (hasVenueReliability ? 4 : 0) +
          (hasVenueFailureWarGame ? 4 : 0) +
          (hasSmartRouter ? 5 : 0) +
          (hasQueuePosition ? 5 : 0) +
          (hasLatencyAlphaRace ? 5 : 0) +
          (hasHawkesFlowShock ? 4 : 0) +
          (hasLiquidityMirage ? 4 : 0) +
          (hasLiquidityTopology ? 4 : 0) +
          (hasOpportunityHeatmap ? 4 : 0) +
          (hasWalkForward ? 5 : 0) +
          (hasRegimeBreak ? 5 : 0) +
          (hasConformalGuard ? 6 : 0) +
          (hasOptimalStopping ? 5 : 0) +
          (hasExecutionPlaybook ? 5 : 0) +
          (hasCausalExecutionGraph ? 5 : 0) +
          (hasSequentialExecutionTest ? 5 : 0) +
          (hasExecutionTournament ? 5 : 0) +
          (hasArbitrageGraph ? 6 : 0),
      ),
      proof: `${hasHistorical ? "Historical stat-arb/backtest" : "No historical backtest yet"}, ${hasOpportunityHeatmap ? `heatmap ${input.opportunityHeatmap?.summary.policy}` : "no opportunity heatmap"}, ${hasWalkForward ? `walk-forward ${input.walkForwardRobustness?.summary.policy}` : "no walk-forward validation"}, ${hasRegimeBreak ? `regime break ${input.regimeBreakLab?.summary.policy}` : "no regime break detector"}, ${hasConformalGuard ? `conformal guard ${input.conformalGuard?.summary.policy}` : "no conformal guard"}, ${hasOptimalStopping ? `optimal stopping ${input.optimalStoppingFrontier?.summary.policy}` : "no optimal stopping frontier"}, ${hasExecutionTournament ? `tournament ${input.executionTournament?.summary.policy}` : "no execution tournament"}, ${hasArbitrageGraph ? `arbitrage graph ${input.arbitrageGraph?.summary.policy}` : "no arbitrage graph"}, ${hasLatencyAlphaRace ? `latency alpha ${input.latencyAlphaRace?.summary.policy}` : "no latency alpha race"}, ${hasHawkesFlowShock ? `hawkes flow ${input.hawkesFlowShock?.summary.policy}` : "no Hawkes flow shock"}, ${hasLiquidityMirage ? `liquidity mirage ${input.liquidityMirage?.summary.policy}` : "no liquidity mirage detector"}, ${hasLiquidityTopology ? `liquidity topology ${input.liquidityTopology?.summary.policy}` : "no liquidity topology"}, ${hasExecutionPlaybook ? `playbook ${input.executionPlaybook?.summary.recommendedAction}` : "no autonomous playbook"}, ${hasCausalExecutionGraph ? `causal graph ${input.causalExecutionGraph?.summary.finalDecision}` : "no causal execution graph"}, ${hasSequentialExecutionTest ? `SPRT ${input.sequentialExecutionTest?.summary.decision}` : "no sequential execution test"}, ${hasCashCarry ? `cash-and-carry ${input.cashCarryLab?.summary.recommendedAction}` : "no cash-and-carry"}, ${hasSettlementRisk ? `settlement ${input.settlementRisk?.summary.policy}` : "no settlement oracle"}, ${hasDerivativesPressure ? "derivatives pressure oracle" : "no derivatives pressure"}, ${hasOptionsIv ? "options IV oracle" : "no options IV"}, ${hasTriangular ? "triangular lab" : "no triangular lab"}, ${hasMexicoCorridor ? "Mexico cross-currency corridor" : "no Mexico corridor"}, ${hasConsensus ? "price consensus oracle" : "no price consensus"}, ${hasUsdtBasis ? "USDT basis oracle" : "no USDT basis"}, ${hasLeadLag ? `lead-lag ${input.leadLag?.summary.policy}` : "no lead-lag oracle"}, ${hasVenueReliability ? `venue reliability ${input.venueReliability?.summary.policy}` : "no venue reliability oracle"}, ${hasVenueFailureWarGame ? `failure war game ${input.venueFailureWarGame?.summary.policy}` : "no failure war game"}, ${hasSmartRouter ? `smart router ${input.smartOrderRouter?.summary.policy}` : "no smart router"}, ${hasQueuePosition ? `queue ${input.queuePosition?.summary.recommendation}` : "no queue oracle"}, ${hasExecutionRegime ? `execution regime ${input.executionRegime?.action}` : "no execution regime fusion"}, ${hasCapitalOptimizer ? `capital optimizer ${input.capitalOptimizer?.summary.policy}` : "no capital optimizer"}, ${hasLiquidityRadar ? "REST liquidity radar" : "no REST liquidity radar"}.`,
      nextMove: "Use Strategy Arena, Walk-Forward Robustness Lab, Bayesian Regime Break Detector, Conformal Execution Guard, Optimal Stopping Frontier, Execution Tournament, Cross-Venue Arbitrage Graph, Liquidity Topology Map, Latency Alpha Race Simulator, Hawkes Flow Shock Oracle, Liquidity Mirage Detector, Sequential Execution Test, Autonomous Execution Playbook, Causal Execution Evidence Graph, Smart Order Router, Queue Position Oracle, Venue Reliability Oracle, Venue Failure War Game, Lead-Lag Execution Oracle, Capital Allocation Optimizer, Cash-and-Carry, Settlement Risk, Options IV, Derivatives Pressure, Mexico Corridor, Price Consensus, USDT Basis, Execution Regime Fusion, Triangular Lab, and Global Liquidity Radar to prove this is more than best-bid/best-ask scanning.",
    }),
    criterion({
      id: "architecture",
      label: "Architecture and maintainability",
      score: clampScore(84 + Math.min(10, sourceCount) + (hasReceipt ? 4 : 0)),
      proof: `${sourceCount} public API source references, ${BACKEND_MODULE_COUNT} Next.js Route Handler backend modules, normalized adapters, pure quant modules, worker engine, and IndexedDB journal.`,
      nextMove: "Open Backend Evidence so reviewers can verify full-stack architecture directly from /api/health and /api/backend-manifest.",
    }),
    criterion({
      id: "presentation",
      label: "Web app presentation",
      score: input.scorecard.presentation,
      proof: "Cockpit-first UI with judge mode, quant lab, market map, replay, wallets, P&L, rejected opportunities, and risk governor.",
      nextMove: "Run the 90-second demo in order; avoid explaining implementation before showing evidence.",
    }),
  ];

  const readinessScore = Math.round(
    criteria.reduce((sum, item) => sum + item.score, 0) / Math.max(1, criteria.length),
  );
  const gaps = criteria
    .filter((item) => item.status !== "strong")
    .map((item) => `${item.label}: ${item.nextMove}`)
    .slice(0, 3);

  return {
    readinessScore,
    verdict:
      readinessScore >= 88 && gaps.length <= 1
        ? "national-final-ready"
        : readinessScore >= 78
          ? "demo-ready"
          : "needs-live-evidence",
    criteria,
    demoSteps: buildDemoSteps({
      sourceCount,
      hasHistorical,
      hasOpportunityHeatmap,
      hasCashCarry,
      hasSettlementRisk,
      hasDerivativesPressure,
      hasOptionsIv,
      hasTriangular,
      hasMexicoCorridor,
      hasVenueMap,
      hasLiquidityRadar,
      hasUsdtBasis,
      hasVenueLatency: Boolean(input.venueLatency?.venues.length),
      hasLeadLag,
      hasVenueReliability,
      hasVenueFailureWarGame,
      hasSmartRouter,
      hasQueuePosition,
      hasLatencyAlphaRace,
      hasHawkesFlowShock,
      hasLiquidityMirage,
      hasLiquidityTopology,
      hasExecutionPlaybook,
      hasCausalExecutionGraph,
      hasSequentialExecutionTest,
      hasExecutionTournament,
      hasArbitrageGraph,
      hasWalkForward,
      hasRegimeBreak,
      hasConformalGuard,
      hasOptimalStopping,
      hasExecutionRegime,
      hasCapitalOptimizer,
      hasReceipt,
      rejectedCount,
      governor: input.governor,
      capitalPolicy: input.capitalOptimizer?.summary.policy,
      leadLagPolicy: input.leadLag?.summary.policy,
      venueReliabilityPolicy: input.venueReliability?.summary.policy,
      venueFailurePolicy: input.venueFailureWarGame?.summary.policy,
      smartRouterPolicy: input.smartOrderRouter?.summary.policy,
      queuePolicy: input.queuePosition?.summary.recommendation,
      latencyAlphaRacePolicy: input.latencyAlphaRace?.summary.policy,
      hawkesFlowPolicy: input.hawkesFlowShock?.summary.policy,
      liquidityMiragePolicy: input.liquidityMirage?.summary.policy,
      liquidityTopologyPolicy: input.liquidityTopology?.summary.policy,
      opportunityHeatmapPolicy: input.opportunityHeatmap?.summary.policy,
      walkForwardPolicy: input.walkForwardRobustness?.summary.policy,
      regimeBreakPolicy: input.regimeBreakLab?.summary.policy,
      conformalPolicy: input.conformalGuard?.summary.policy,
      optimalStoppingPolicy: input.optimalStoppingFrontier?.summary.policy,
      executionPlaybookAction: input.executionPlaybook?.summary.recommendedAction,
      causalExecutionDecision: input.causalExecutionGraph?.summary.finalDecision,
      sequentialExecutionDecision: input.sequentialExecutionTest?.summary.decision,
      executionTournamentPolicy: input.executionTournament?.summary.policy,
      arbitrageGraphPolicy: input.arbitrageGraph?.summary.policy,
    }),
    decisionReceipt: input.decision
      ? buildDecisionAuditReceipt({
          decision: input.decision,
          governor: input.governor,
          marketContext: input.marketContext,
          historicalReplay: input.historicalReplay,
          sourceCount,
        })
      : undefined,
    sourceCount,
    gaps,
  };
}

export function buildDecisionAuditReceipt(input: {
  decision: OpportunityDecision;
  governor: RiskGovernor;
  marketContext?: MarketContext;
  historicalReplay?: HistoricalReplay;
  sourceCount: number;
}): DecisionAuditReceipt {
  const decision = input.decision;
  const payload = {
    id: decision.id,
    status: decision.status,
    route: `${decision.buyExchange}->${decision.sellExchange}`,
    observedAt: decision.observedAt,
    quoteAsset: decision.quoteAsset,
    tradeSizeBtc: round(decision.tradeSizeBtc, 8),
    grossProfitUsd: round(decision.grossProfitUsd),
    netProfitUsd: round(decision.netProfitUsd),
    feeCostUsd: round(decision.risk.feeCostUsd),
    withdrawalCostUsd: round(decision.risk.withdrawalCostUsd),
    latencyPenaltyUsd: round(decision.risk.latencyPenaltyUsd),
    pWin: round(decision.risk.positivePnlProbability, 6),
    governorState: input.governor.state,
    volatility: round(input.marketContext?.volatility.realizedVolBpsPerSecond ?? 0, 6),
    statArbZ: round(input.historicalReplay?.statArb.latestZScore ?? 0, 6),
    sourceCount: input.sourceCount,
    rejectionReasons: decision.rejectionReasons,
  };

  return {
    fingerprint: `arbx-${fnv1a(stableStringify(payload))}`,
    decisionId: decision.id,
    status: decision.status,
    route: `${decision.buyExchange.toUpperCase()} buy -> ${decision.sellExchange.toUpperCase()} sell (${decision.quoteAsset})`,
    observedAt: decision.observedAt,
    formulaRows: [
      { label: "Trade size", value: decision.tradeSizeBtc, unit: "BTC" },
      { label: "Gross spread P&L", value: decision.grossProfitUsd, unit: "USD" },
      { label: "Taker fees", value: decision.risk.feeCostUsd, unit: "USD" },
      { label: "Rebalance cost", value: decision.risk.withdrawalCostUsd, unit: "USD" },
      { label: "Latency haircut", value: decision.risk.latencyPenaltyUsd, unit: "USD" },
      { label: "Final net P&L", value: decision.netProfitUsd, unit: "USD" },
      { label: "Positive P&L probability", value: decision.risk.positivePnlProbability, unit: "probability" },
      { label: "Risk score", value: decision.risk.score, unit: "score" },
    ],
    policyRows: [
      { label: "Governor", value: `${input.governor.state} (${input.governor.score}/100)` },
      {
        label: "Volatility input",
        value: `${round(input.marketContext?.volatility.realizedVolBpsPerSecond ?? 0, 4)} bps/s`,
      },
      {
        label: "Historical stat-arb",
        value: input.historicalReplay
          ? `${input.historicalReplay.statArb.regime}, z=${round(input.historicalReplay.statArb.latestZScore, 2)}`
          : "not loaded",
      },
      { label: "Public source refs", value: String(input.sourceCount) },
    ],
    rejectionReasons: decision.rejectionReasons,
    provenance: [
      "Normalized L2 order book event",
      "Depth-walk VWAP fill simulator",
      "Fee, rebalance, latency, and basis policy",
      "Risk governor and stress lab",
      ...(input.marketContext ? ["Public market context APIs"] : []),
      ...(input.historicalReplay ? ["Historical Kraken/Coinbase replay"] : []),
    ],
  };
}

function buildDemoSteps(input: {
  sourceCount: number;
  hasHistorical: boolean;
  hasOpportunityHeatmap: boolean;
  hasCashCarry: boolean;
  hasSettlementRisk: boolean;
  hasDerivativesPressure: boolean;
  hasOptionsIv: boolean;
  hasTriangular: boolean;
  hasMexicoCorridor: boolean;
  hasVenueMap: boolean;
  hasLiquidityRadar: boolean;
  hasUsdtBasis: boolean;
  hasVenueLatency: boolean;
  hasLeadLag: boolean;
  hasVenueReliability: boolean;
  hasVenueFailureWarGame: boolean;
  hasSmartRouter: boolean;
  hasQueuePosition: boolean;
  hasLatencyAlphaRace: boolean;
  hasHawkesFlowShock: boolean;
  hasLiquidityMirage: boolean;
  hasLiquidityTopology: boolean;
  hasExecutionPlaybook: boolean;
  hasCausalExecutionGraph: boolean;
  hasSequentialExecutionTest: boolean;
  hasExecutionTournament: boolean;
  hasArbitrageGraph: boolean;
  hasWalkForward: boolean;
  hasRegimeBreak: boolean;
  hasConformalGuard: boolean;
  hasOptimalStopping: boolean;
  hasExecutionRegime: boolean;
  hasCapitalOptimizer: boolean;
  hasReceipt: boolean;
  rejectedCount: number;
  governor: RiskGovernor;
  capitalPolicy?: CapitalAllocationOptimizer["summary"]["policy"];
  leadLagPolicy?: LeadLagOracle["summary"]["policy"];
  venueReliabilityPolicy?: VenueReliabilityOracle["summary"]["policy"];
  venueFailurePolicy?: VenueFailureWarGame["summary"]["policy"];
  smartRouterPolicy?: SmartOrderRouterPlan["summary"]["policy"];
  queuePolicy?: QueuePositionOracle["summary"]["recommendation"];
  latencyAlphaRacePolicy?: LatencyAlphaRace["summary"]["policy"];
  hawkesFlowPolicy?: HawkesFlowShockOracle["summary"]["policy"];
  liquidityMiragePolicy?: LiquidityMirageDetector["summary"]["policy"];
  liquidityTopologyPolicy?: LiquidityTopologyMap["summary"]["policy"];
  opportunityHeatmapPolicy?: OpportunityHeatmap["summary"]["policy"];
  walkForwardPolicy?: WalkForwardRobustness["summary"]["policy"];
  regimeBreakPolicy?: BayesianRegimeBreakLab["summary"]["policy"];
  conformalPolicy?: ConformalExecutionGuard["summary"]["policy"];
  optimalStoppingPolicy?: OptimalStoppingFrontier["summary"]["policy"];
  executionPlaybookAction?: ExecutionPlaybook["summary"]["recommendedAction"];
  causalExecutionDecision?: CausalExecutionGraph["summary"]["finalDecision"];
  sequentialExecutionDecision?: SequentialExecutionTest["summary"]["decision"];
  executionTournamentPolicy?: ExecutionTournament["summary"]["policy"];
  arbitrageGraphPolicy?: CrossVenueArbitrageGraph["summary"]["policy"];
}): DemoStep[] {
  return [
    {
      id: "cockpit",
      view: "cockpit",
      label: "Prove live/replay execution realism",
      timeboxSeconds: 15,
      kpi: "L2 books + best route",
      proof: "Show normalized books, top route, wallet constraints, and explicit rejection reasons.",
    },
    {
      id: "quant",
      view: "quant",
      label: "Show the math, not just a spread",
      timeboxSeconds: 15,
      kpi: "VWAP, P(win), impact",
      proof: "Open Quant Lab for microprice, imbalance, volatility, impact curve, risk cone, Monte Carlo, and Kelly sizing.",
    },
    {
      id: "market",
      view: "market",
      label: "Cross-check with external market data",
      timeboxSeconds: 10,
      kpi: `${input.sourceCount} public sources`,
      proof: input.hasVenueMap
        ? "Show CoinGecko venue quality, market-wide route candidates, and REST liquidity radar."
        : "Venue map is still loading; explain graceful degradation.",
    },
    {
      id: "liquidity-radar",
      view: "market",
      label: "Prove broad executable depth",
      timeboxSeconds: 10,
      kpi: input.hasLiquidityRadar ? "REST L2 venue sweep" : "radar loading",
      proof: "Show public REST order books ranked by net executable route, with WebSocket fallback evidence for slow venues.",
    },
    {
      id: "backend-evidence",
      view: "backend",
      label: "Prove frontend plus backend delivery",
      timeboxSeconds: 10,
      kpi: `${BACKEND_MODULE_COUNT} serverless API modules`,
      proof: "Show /api/health, /api/backend-manifest, no private API keys, no required database, and server-side public-data adapters.",
    },
    {
      id: "liquidity-topology",
      view: "market",
      label: "Map liquidity geometry",
      timeboxSeconds: 10,
      kpi: input.hasLiquidityTopology ? `topology ${input.liquidityTopologyPolicy}` : "topology loading",
      proof: "Show Wasserstein order-book shape distances, central venue, outliers, fragmentation score, and topology routing haircut.",
    },
    {
      id: "arbitrage-graph",
      view: "market",
      label: "Solve arbitrage as a graph",
      timeboxSeconds: 10,
      kpi: input.hasArbitrageGraph ? `graph ${input.arbitrageGraphPolicy}` : "graph loading",
      proof: "Show route evidence converted into nodes, edges, -log(rate) weights, and Bellman-Ford negative-cycle proof.",
    },
    {
      id: "smart-router",
      view: "market",
      label: "Split across marginal depth",
      timeboxSeconds: 10,
      kpi: input.hasSmartRouter ? `SOR ${input.smartRouterPolicy}` : "router loading",
      proof: "Show a multi-venue buy/sell sweep that compares smart-routed net P&L against the best single venue route.",
    },
    {
      id: "usdt-basis",
      view: "market",
      label: "Defend USD/USDT lane risk",
      timeboxSeconds: 8,
      kpi: input.hasUsdtBasis ? "dynamic USDT haircut" : "basis loading",
      proof: "Show Coinbase, Kraken, Bitstamp, and CoinGecko USDT/USD consensus before trusting cross-lane spreads.",
    },
    {
      id: "mexico-corridor",
      view: "mexico",
      label: "Localize the strategy to Mexico",
      timeboxSeconds: 10,
      kpi: input.hasMexicoCorridor ? "BTC/MXN + USD/MXN depth" : "corridor loading",
      proof: "Show Bitso BTC/MXN, Bitso USD/MXN, and Coinbase BTC/USD depth in one cross-currency route.",
    },
    {
      id: "triangular",
      view: "triangular",
      label: "Demonstrate a second strategy class",
      timeboxSeconds: 10,
      kpi: input.hasTriangular ? "3-leg L2 cycle" : "fallback pending",
      proof: "Show USD/BTC/ETH single-venue triangular simulation with three fee-paid legs.",
    },
    {
      id: "derivatives-pressure",
      view: "quant",
      label: "Measure futures pressure",
      timeboxSeconds: 10,
      kpi: input.hasDerivativesPressure ? "funding + perp premium" : "derivatives loading",
      proof: "Show OKX, Deribit, and BitMEX perpetual funding/premium before trusting spot execution.",
    },
    {
      id: "queue-position",
      view: "quant",
      label: "Choose maker or taker",
      timeboxSeconds: 10,
      kpi: input.hasQueuePosition ? `queue ${input.queuePolicy}` : "needs route",
      proof: "Show queue-ahead BTC, aggressor flow, Poisson fill probability, adverse selection, and maker-vs-taker EV.",
    },
    {
      id: "latency-alpha-race",
      view: "quant",
      label: "Race faster bots",
      timeboxSeconds: 10,
      kpi: input.hasLatencyAlphaRace ? `race ${input.latencyAlphaRacePolicy}` : "race loading",
      proof: "Show edge half-life, public latency p95, aggressive flow, survival probability, and expected capture before crossing.",
    },
    {
      id: "optimal-stopping-frontier",
      view: "quant",
      label: "Solve execute-now versus wait",
      timeboxSeconds: 10,
      kpi: input.hasOptimalStopping ? `timing ${input.optimalStoppingPolicy}` : "timing loading",
      proof: "Show expected value across wait horizons after edge decay, volatility cost, conformal downside, and historical opportunity clustering.",
    },
    {
      id: "hawkes-flow-shock",
      view: "quant",
      label: "Detect self-exciting flow",
      timeboxSeconds: 10,
      kpi: input.hasHawkesFlowShock ? `hawkes ${input.hawkesFlowPolicy}` : "flow loading",
      proof: "Show branching ratio, aftershock probability, expected shock BTC, shock half-life, and top-depth coverage from public recent trades.",
    },
    {
      id: "liquidity-mirage",
      view: "quant",
      label: "Reject fake top-book spreads",
      timeboxSeconds: 10,
      kpi: input.hasLiquidityMirage ? `mirage ${input.liquidityMiragePolicy}` : "needs route",
      proof: "Show retained edge, depth convexity, fill completeness, top-level concentration, and smart-router confirmation before trusting the spread.",
    },
    {
      id: "cash-carry",
      view: "quant",
      label: "Simulate institutional basis carry",
      timeboxSeconds: 10,
      kpi: input.hasCashCarry ? "spot/perp carry route" : "carry loading",
      proof: "Show spot-perp basis, projected funding, taker fees, rebalance cost, adverse basis stress, and liquidation buffer.",
    },
    {
      id: "settlement-risk",
      view: "replay",
      label: "Price withdrawal and settlement risk",
      timeboxSeconds: 10,
      kpi: input.hasSettlementRisk ? "mempool projected blocks" : "settlement loading",
      proof: "Show mempool.space fee tiers, projected blocks, USD withdrawal cost, stranding risk, and rebalance policy.",
    },
    {
      id: "options-iv",
      view: "quant",
      label: "Show forward volatility",
      timeboxSeconds: 10,
      kpi: input.hasOptionsIv ? "Deribit options IV" : "options loading",
      proof: "Show Deribit BTC options implied volatility, expected move, and execution haircut.",
    },
    {
      id: "venue-reliability",
      view: "market",
      label: "Gate unreliable venues",
      timeboxSeconds: 10,
      kpi: input.hasVenueReliability ? `ops ${input.venueReliabilityPolicy}` : "ops loading",
      proof: "Show public venue status pages crossed with endpoint latency to allow, cap, or halt simulated routing per exchange.",
    },
    {
      id: "venue-failure",
      view: "replay",
      label: "War-game venue failure",
      timeboxSeconds: 10,
      kpi: input.hasVenueFailureWarGame ? `failure ${input.venueFailurePolicy}` : "needs accepted route",
      proof: "Show outage after one leg, emergency unwind P&L, trapped capital, backup inventory, and the final failover or halt policy.",
    },
    {
      id: "lead-lag",
      view: "quant",
      label: "Predict who moves first",
      timeboxSeconds: 10,
      kpi: input.hasLeadLag ? `lead-lag ${input.leadLagPolicy}` : "lead-lag loading",
      proof: "Show recent public trades bucketized across venues, lagged correlations, leader/follower pairs, predicted drift, and execution haircut.",
    },
    {
      id: "execution-playbook",
      view: "judge",
      label: "Choose the simulated action",
      timeboxSeconds: 10,
      kpi: input.hasExecutionPlaybook ? `playbook ${input.executionPlaybookAction}` : "playbook loading",
      proof: "Show ranked cross-now, smart-route, maker, rebalance, wait, and halt actions with P&L, risk, confidence, and hard stops.",
    },
    {
      id: "causal-execution-graph",
      view: "judge",
      label: "Explain the final decision",
      timeboxSeconds: 10,
      kpi: input.hasCausalExecutionGraph ? `causal ${input.causalExecutionDecision}` : "causal graph loading",
      proof: "Show the evidence graph linking market edge, Bayesian conviction, walk-forward validation, latency race, risk governor, playbook, and the final simulated decision.",
    },
    {
      id: "sequential-execution-test",
      view: "judge",
      label: "Run statistical execution gate",
      timeboxSeconds: 10,
      kpi: input.hasSequentialExecutionTest ? `SPRT ${input.sequentialExecutionDecision}` : "SPRT loading",
      proof: "Show upper/lower Wald boundaries, accumulated log-likelihood, alpha/beta risks, hard blockers, and whether the simulator executes, caps, samples, or rejects.",
    },
    {
      id: "execution-regime",
      view: "judge",
      label: "Fuse all public signals",
      timeboxSeconds: 10,
      kpi: input.hasExecutionRegime ? "single execution regime" : "regime loading",
      proof: "Show the action selected after combining spot liquidity, toxic flow, derivatives pressure, options IV, basis, consensus, and venue latency.",
    },
    {
      id: "capital-allocation",
      view: "judge",
      label: "Allocate simulated bankroll",
      timeboxSeconds: 10,
      kpi: input.hasCapitalOptimizer ? `portfolio ${input.capitalPolicy}` : "allocator loading",
      proof: "Show bankroll allocation across live arb, cash-and-carry, Mexico corridor, triangular cycle, historical replay, and liquidity radar with CVaR and capacity caps.",
    },
    {
      id: "backtest",
      view: "backtest",
      label: "Use historical evidence",
      timeboxSeconds: 15,
      kpi: input.hasHistorical ? "stat-arb + arena" : "historical loading",
      proof: "Show Strategy Arena, sensitivity surface, and mean-reversion/lead-lag signal.",
    },
    {
      id: "opportunity-heatmap",
      view: "backtest",
      label: "Show historical opportunity clusters",
      timeboxSeconds: 10,
      kpi: input.hasOpportunityHeatmap ? `heatmap ${input.opportunityHeatmapPolicy}` : "heatmap loading",
      proof: "Show the UTC hour by edge-tier matrix to prove whether real historical opportunities cluster or appear as noise.",
    },
    {
      id: "walk-forward",
      view: "backtest",
      label: "Prove it is not overfit",
      timeboxSeconds: 10,
      kpi: input.hasWalkForward ? `walk-forward ${input.walkForwardPolicy}` : "walk-forward loading",
      proof: "Show the trained spread filter, train/test split, out-of-sample P&L, generalization ratio, and overfit penalty.",
    },
    {
      id: "regime-break",
      view: "backtest",
      label: "Detect historical regime breaks",
      timeboxSeconds: 10,
      kpi: input.hasRegimeBreak ? `BOCPD ${input.regimeBreakPolicy}` : "regime loading",
      proof: "Show Bayesian online change-point posterior, run length, spread shift, and whether historical evidence should be trusted, capped, or retrained.",
    },
    {
      id: "conformal-execution-guard",
      view: "backtest",
      label: "Demand finite-sample downside proof",
      timeboxSeconds: 10,
      kpi: input.hasConformalGuard ? `conformal ${input.conformalPolicy}` : "conformal loading",
      proof: "Show split-conformal residual calibration, expected net, lower bound, coverage target, and whether live size should execute, cap, or wait.",
    },
    {
      id: "execution-tournament",
      view: "backtest",
      label: "Beat rival bot policies",
      timeboxSeconds: 10,
      kpi: input.hasExecutionTournament ? `tournament ${input.executionTournamentPolicy}` : "tournament loading",
      proof: "Show naive spread chasing, conservative, balanced, aggressive, walk-forward, and ArbX-Ray autopilot ranked by P&L, regret, drawdown, and exploitability.",
    },
    {
      id: "venue-latency",
      view: "judge",
      label: "Prove venue speed discipline",
      timeboxSeconds: 10,
      kpi: input.hasVenueLatency ? "REST latency race" : "latency loading",
      proof: "Show p50/p95/jitter, availability, and latency P&L haircut across public venue endpoints.",
    },
    {
      id: "judge",
      view: "judge",
      label: "Close with execution discipline",
      timeboxSeconds: 15,
      kpi: `governor ${input.governor.state}`,
      proof: input.hasReceipt
        ? "Show the audit receipt fingerprint and exact formula inputs."
        : "Generate a replay route first, then show the receipt.",
    },
    {
      id: "replay",
      view: "replay",
      label: "Show what the bot refused",
      timeboxSeconds: 10,
      kpi: `${input.rejectedCount} rejected`,
      proof: "Rejected opportunities prove the simulator blocks bad trades instead of chasing noise.",
    },
  ];
}

function criterion(input: Omit<ChallengeCriterionEvidence, "status">): ChallengeCriterionEvidence {
  return {
    ...input,
    score: clampScore(input.score),
    status: input.score >= 85 ? "strong" : input.score >= 70 ? "watch" : "gap",
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

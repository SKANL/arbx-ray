"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Database,
  Fingerprint,
  Gauge,
  History,
  LineChart,
  Layers3,
  Network,
  Play,
  RadioTower,
  Rocket,
  Search,
  ShieldCheck,
  Square,
  MapPin,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { exchangeAdapters } from "@/lib/market/adapters";
import { buildPolylinePoints, chartDomain, polylineAttribute, summarizeChartSeries } from "@/lib/market/charting";
import { buildCapitalAllocationOptimizer, type AllocationCandidate, type CapitalAllocationOptimizer } from "@/lib/market/capital-allocation";
import { buildConformalExecutionGuard, type ConformalExecutionGuard, type ConformalCalibrationPoint } from "@/lib/market/conformal-execution-guard";
import { buildCrossVenueArbitrageGraph, type ArbitrageGraphCycle, type ArbitrageGraphEdge, type CrossVenueArbitrageGraph } from "@/lib/market/arbitrage-graph";
import { buildCausalExecutionGraph, type CausalExecutionGraph, type CausalExecutionNode } from "@/lib/market/causal-execution-graph";
import { defaultEnabledExchanges, defaultEngineConfig, defaultWallets } from "@/lib/market/defaults";
import { buildDecisionGateChecklist, type DecisionGate } from "@/lib/market/decision-gates";
import type { CashCarryLab, CarryRoute } from "@/lib/market/cash-carry";
import type { DerivativesPressureOracle, DerivativesVenuePressureScore } from "@/lib/market/derivatives-pressure";
import { buildEdgeConviction, type EdgeConviction } from "@/lib/market/edge-conviction";
import { buildEvidenceNavigator, type EvidenceCoverage, type EvidenceNavigator, type EvidenceRouteItem } from "@/lib/market/evidence-navigator";
import { buildExecutionPlaybook, type ExecutionPlaybook, type ExecutionPlaybookAction } from "@/lib/market/execution-playbook";
import { buildExecutionRegimeFusion, type ExecutionRegimeFusion } from "@/lib/market/execution-regime";
import { buildExecutionTournament, type ExecutionTournament, type ExecutionTournamentContestant } from "@/lib/market/execution-tournament";
import { buildHawkesFlowShockOracle, type HawkesFlowShockOracle, type HawkesVenueState } from "@/lib/market/hawkes-flow";
import { buildLatencyRiskCone, deriveKellySizing, runMonteCarloExecution } from "@/lib/market/execution-risk";
import { buildLatencyAlphaRace, type LatencyAlphaRace } from "@/lib/market/latency-alpha-race";
import { buildLiquidityMirageDetector, type LiquidityMirageDetector, type LiquidityMirageFactorState } from "@/lib/market/liquidity-mirage";
import { buildLiquidityTopologyMap, type LiquidityTopologyLink, type LiquidityTopologyMap, type LiquidityTopologyVenue } from "@/lib/market/liquidity-topology";
import { buildSequentialExecutionTest, type SequentialExecutionTest, type SequentialEvidenceStep } from "@/lib/market/sequential-execution-test";
import { buildJudgeScorecard, runStressScenarios, summarizeImpactCurve } from "@/lib/market/stress";
import type { HistoricalReplay, HistoricalStrategyRun } from "@/lib/market/historical";
import type { LeadLagOracle, LeadLagPair, LeadLagVenueSignal } from "@/lib/market/lead-lag";
import { buildExecutionDepthLens } from "@/lib/market/depth-lens";
import { buildPnlWaterfall } from "@/lib/market/pnl-waterfall";
import type { DashboardPanelAction } from "@/lib/market/panel-actions";
import { buildEngineThroughputLab, type EngineThroughputLab } from "@/lib/market/performance-lab";
import { buildBayesianRegimeBreakLab, type BayesianRegimeBreakLab, type RegimeBreakObservation } from "@/lib/market/regime-break";
import { buildRebalancePlanner, type RebalancePlanner } from "@/lib/market/rebalance-planner";
import { buildRiskGovernor, type RiskGovernor } from "@/lib/market/risk-governor";
import type { SettlementRiskOracle, SettlementTier } from "@/lib/market/settlement-risk";
import { buildSmartOrderRouter, type SmartOrderRouterPlan, type SmartOrderSlice } from "@/lib/market/smart-order-router";
import { buildChallengeEvidence, type ChallengeCriterionEvidence, type ChallengeCriterionId, type ChallengeEvidence, type DashboardView } from "@/lib/market/challenge-evidence";
import { useDashboardPublicData, type BackendEvidenceState } from "@/hooks/use-dashboard-public-data";
import { useEngineWorker } from "@/hooks/use-engine-worker";
import { useEngineStore } from "@/store/engine-store";
import type { MarketContext } from "@/lib/market/context";
import type { BackendModule } from "@/lib/market/backend-manifest";
import type { LiquidityRadar, LiquidityRoute, LiquidityVenueBook } from "@/lib/market/liquidity-radar";
import type { MexicoCorridorLab, MexicoCorridorLeg, MexicoCorridorRoute } from "@/lib/market/mexico-corridor";
import type { OptionsIvOracle, SelectedOptionIvQuote } from "@/lib/market/options-iv";
import { buildOptimalStoppingFrontier, type OptimalStoppingFrontier, type StoppingFrontierPoint } from "@/lib/market/optimal-stopping-frontier";
import { buildOpportunityHeatmap, type OpportunityEdgeTier, type OpportunityHeatmap, type OpportunityHeatmapCell } from "@/lib/market/opportunity-heatmap";
import type { ConsensusVenue, PriceConsensusOracle } from "@/lib/market/price-consensus";
import { buildQueuePositionOracle, type QueueLegEstimate, type QueuePositionOracle } from "@/lib/market/queue-position";
import type { TradeTapeToxicity, TradeTapeVenueSummary } from "@/lib/market/trade-tape";
import type { TriangularLab, TriangularLeg, TriangularRoute } from "@/lib/market/triangular";
import type { UsdtBasisOracle, UsdtBasisVenue } from "@/lib/market/usdt-basis";
import { buildVenueFailureWarGame, type VenueFailureScenario, type VenueFailureWarGame } from "@/lib/market/venue-failure";
import type { VenueLatencyRace, VenueLatencyScore } from "@/lib/market/venue-latency";
import type { VenueIntelligence, VenueRoute, VenueTicker } from "@/lib/market/venue-intelligence";
import type { VenueReliabilityOracle, VenueReliabilityScore } from "@/lib/market/venue-reliability";
import { buildWalkForwardRobustness, type WalkForwardRobustness } from "@/lib/market/walk-forward";
import { buildDecisionNetFormula } from "@/lib/market/formula";
import { buildDataReadinessRail, type DataReadinessItem } from "@/lib/market/data-readiness";
import { buildViewActions, type ViewAction } from "@/lib/market/view-actions";
import type { ExchangeId, FeedHealth, OpportunityDecision, OrderBookSnapshot, TradeEvent } from "@/lib/market/types";
import { AccessibleChartSvg, ChartFrame } from "@/components/dashboard/chart-frame";
import { dispatchPanelAction, EmptyState } from "@/components/dashboard/empty-state";
import { FormulaExplainer } from "@/components/dashboard/formula-explainer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Panel } from "@/components/ui/panel";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const btc = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});

export function Dashboard() {
  const { startLive, stop, replay, clearSession } = useEngineWorker();
  const [enabled, setEnabled] = useState<ExchangeId[]>(defaultEnabledExchanges);
  const [activeView, setActiveView] = useState<DashboardView>("cockpit");
  const {
    backendEvidence,
    marketContext,
    cashCarryLab,
    settlementRisk,
    derivativesPressure,
    optionsIv,
    historicalReplay,
    venueIntelligence,
    liquidityRadar,
    mexicoCorridor,
    priceConsensus,
    usdtBasis,
    tradeTape,
    leadLag,
    venueLatency,
    venueReliability,
    triangularLab,
    refreshPublicData,
  } = useDashboardPublicData();
  const mode = useEngineStore((state) => state.mode);
  const books = useEngineStore((state) => state.books);
  const best = useEngineStore((state) => state.best);
  const currentBest = useEngineStore((state) => state.currentBest);
  const latestDecision = useEngineStore((state) => state.latestDecision);
  const lastEngineTickAt = useEngineStore((state) => state.lastEngineTickAt);
  const routeFreshnessMs = useEngineStore((state) => state.routeFreshnessMs);
  const routeState = useEngineStore((state) => state.routeState);
  const routeMessage = useEngineStore((state) => state.routeMessage);
  const recent = useEngineStore((state) => state.recent);
  const trades = useEngineStore((state) => state.trades);
  const wallets = useEngineStore((state) => state.wallets);
  const health = useEngineStore((state) => state.health);

  const cumulativePnl = trades[0]?.cumulativePnlUsd ?? 0;
  const acceptedCount = trades.length;
  const rejectedCount = recent.filter((item) => item.status === "rejected").length;
  const publicSourceCount = useMemo(
    () =>
      (marketContext?.sources.length ?? 0) +
      (cashCarryLab?.sources.length ?? 0) +
      (settlementRisk?.sources.length ?? 0) +
      (derivativesPressure?.sources.length ?? 0) +
      (optionsIv?.sources.length ?? 0) +
      (venueIntelligence?.sources.length ?? 0) +
      (liquidityRadar?.sources.length ?? 0) +
      (mexicoCorridor?.sources.length ?? 0) +
      (priceConsensus?.sources.length ?? 0) +
      (usdtBasis?.sources.length ?? 0) +
      (leadLag?.sources.length ?? 0) +
      (venueReliability?.sources.length ?? 0) +
      (venueLatency?.sources.length ?? 0) +
      (tradeTape?.sources.length ?? 0),
    [
      cashCarryLab?.sources.length,
      derivativesPressure?.sources.length,
      leadLag?.sources.length,
      liquidityRadar?.sources.length,
      marketContext?.sources.length,
      mexicoCorridor?.sources.length,
      optionsIv?.sources.length,
      priceConsensus?.sources.length,
      settlementRisk?.sources.length,
      tradeTape?.sources.length,
      usdtBasis?.sources.length,
      venueLatency?.sources.length,
      venueReliability?.sources.length,
      venueIntelligence?.sources.length,
    ],
  );
  const stressResults = useMemo(() => (best ? runStressScenarios(best) : []), [best]);
  const riskGovernor = useMemo(
    () =>
      buildRiskGovernor({
        decision: best,
        context: marketContext,
        health,
        stressResults,
      }),
    [best, health, marketContext, stressResults],
  );
  const rebalancePlanner = useMemo(
    () =>
      buildRebalancePlanner({
        wallets,
        btcUsd:
          marketContext?.coingecko?.currentPriceUsd ||
          marketContext?.binance24h?.lastPrice ||
          best?.buyFill.vwap ||
          70_000,
        fastestFeeSatVb: marketContext?.mempoolFees?.fastestFee ?? 0,
        targetBtcPerVenue: defaultEngineConfig.maxTradeBtc,
        targetQuoteUsdPerVenue: 75_000,
      }),
    [
      best?.buyFill.vwap,
      marketContext?.binance24h?.lastPrice,
      marketContext?.coingecko?.currentPriceUsd,
      marketContext?.mempoolFees?.fastestFee,
      wallets,
    ],
  );
  const scorecard = useMemo(
    () =>
      buildJudgeScorecard({
        decision: best,
        stressResults,
        liveBooks: books.length,
        enabledVenues: enabled.length,
        publicSources: publicSourceCount,
      }),
    [
      best,
      books.length,
      enabled.length,
      publicSourceCount,
      stressResults,
    ],
  );
  const executionRegime = useMemo(
    () =>
      buildExecutionRegimeFusion({
        marketContext,
        tradeTape,
        derivativesPressure,
        optionsIv,
        usdtBasis,
        priceConsensus,
        liquidityRadar,
        leadLag,
        venueLatency,
        venueReliability,
      }),
    [derivativesPressure, leadLag, liquidityRadar, marketContext, optionsIv, priceConsensus, tradeTape, usdtBasis, venueLatency, venueReliability],
  );
  const capitalOptimizer = useMemo(
    () =>
      buildCapitalAllocationOptimizer({
        bankrollUsd: 100_000,
        settlementRiskScore: settlementRisk?.summary.strandingRiskScore ?? 0,
        candidates: buildAllocationCandidates({
          best,
          cashCarryLab,
          mexicoCorridor,
          triangularLab,
          historicalReplay,
          liquidityRadar,
        }),
      }),
    [best, cashCarryLab, historicalReplay, liquidityRadar, mexicoCorridor, settlementRisk, triangularLab],
  );
  const venueFailureWarGame = useMemo(
    () =>
      buildVenueFailureWarGame({
        decision: best,
        wallets,
        reliability: venueReliability,
        btcUsd:
          marketContext?.coingecko?.currentPriceUsd ||
          marketContext?.binance24h?.lastPrice ||
          best?.buyFill.vwap ||
          70_000,
        settlementPenaltyBps: settlementRisk?.summary.settlementPenaltyBps ?? 0,
      }),
    [
      best,
      marketContext?.binance24h?.lastPrice,
      marketContext?.coingecko?.currentPriceUsd,
      settlementRisk?.summary.settlementPenaltyBps,
      venueReliability,
      wallets,
    ],
  );
  const smartOrderRouter = useMemo(
    () =>
      buildSmartOrderRouter({
        radar: liquidityRadar,
        wallets,
        reliability: venueReliability,
        targetSizeBtc: defaultEngineConfig.maxTradeBtc,
      }),
    [liquidityRadar, venueReliability, wallets],
  );
  const liquidityTopology = useMemo(
    () => buildLiquidityTopologyMap({ radar: liquidityRadar }),
    [liquidityRadar],
  );
  const queuePosition = useMemo(
    () =>
      buildQueuePositionOracle({
        decision: best,
        books,
        tape: tradeTape,
        horizonMs: 12_000,
      }),
    [best, books, tradeTape],
  );
  const latencyAlphaRace = useMemo(
    () =>
      buildLatencyAlphaRace({
        decision: best,
        venueLatency,
        tradeTape,
        realizedVolBpsPerSecond:
          marketContext?.volatility.realizedVolBpsPerSecond ||
          defaultEngineConfig.latencyVolatilityBpsPerSecond,
      }),
    [best, marketContext?.volatility.realizedVolBpsPerSecond, tradeTape, venueLatency],
  );
  const liquidityMirage = useMemo(
    () =>
      buildLiquidityMirageDetector({
        decision: best,
        smartOrderRouter,
      }),
    [best, smartOrderRouter],
  );
  const hawkesFlowShock = useMemo(
    () =>
      buildHawkesFlowShockOracle({
        tradeTape,
        topDepthBtc: best
          ? Math.max(
              0.001,
              Math.min(
                best.buyFill.levelsUsed[0]?.filledBtc ?? best.tradeSizeBtc,
                best.sellFill.levelsUsed[0]?.filledBtc ?? best.tradeSizeBtc,
              ),
            )
          : undefined,
      }),
    [best, tradeTape],
  );
  const opportunityHeatmap = useMemo(
    () =>
      buildOpportunityHeatmap({
        replay: historicalReplay,
      }),
    [historicalReplay],
  );
  const walkForwardRobustness = useMemo(
    () => buildWalkForwardRobustness(historicalReplay),
    [historicalReplay],
  );
  const regimeBreakLab = useMemo(
    () => buildBayesianRegimeBreakLab({ replay: historicalReplay }),
    [historicalReplay],
  );
  const conformalGuard = useMemo(
    () =>
      buildConformalExecutionGuard({
        decision: best,
        replay: historicalReplay,
        targetCoverage: 0.9,
        minSamples: 4,
      }),
    [best, historicalReplay],
  );
  const optimalStoppingFrontier = useMemo(
    () =>
      buildOptimalStoppingFrontier({
        decision: best,
        latencyAlphaRace,
        conformalGuard,
        opportunityHeatmap,
        realizedVolBpsPerSecond:
          marketContext?.volatility.realizedVolBpsPerSecond ||
          defaultEngineConfig.latencyVolatilityBpsPerSecond,
      }),
    [best, conformalGuard, latencyAlphaRace, marketContext?.volatility.realizedVolBpsPerSecond, opportunityHeatmap],
  );
  const executionPlaybook = useMemo(
    () =>
      buildExecutionPlaybook({
        decision: best,
        smartOrderRouter,
        queuePosition,
        venueFailureWarGame,
        executionRegime,
        settlementRisk,
        opportunityHeatmap,
      }),
    [best, executionRegime, opportunityHeatmap, queuePosition, settlementRisk, smartOrderRouter, venueFailureWarGame],
  );
  const effectiveConfig = useMemo(
    () => ({
      ...defaultEngineConfig,
      latencyVolatilityBpsPerSecond:
        marketContext?.volatility.realizedVolBpsPerSecond ||
        defaultEngineConfig.latencyVolatilityBpsPerSecond,
      withdrawalFeeBtc:
        marketContext?.mempoolFees?.fastestFee && marketContext.mempoolFees.fastestFee > 20
          ? 0.00012
          : defaultEngineConfig.withdrawalFeeBtc,
    }),
    [marketContext],
  );
  const throughputLab = useMemo(
    () =>
      buildEngineThroughputLab({
        books,
        wallets,
        config: effectiveConfig,
        cycles: 80,
      }),
    [books, effectiveConfig, wallets],
  );
  const edgeConviction = useMemo(
    () =>
      buildEdgeConviction({
        decision: best,
        stressResults,
        historicalReplay,
        liquidityRadar,
        throughput: throughputLab,
        health,
      }),
    [best, health, historicalReplay, liquidityRadar, stressResults, throughputLab],
  );
  const causalExecutionGraph = useMemo(
    () =>
      buildCausalExecutionGraph({
        decision: best,
        governor: riskGovernor,
        edgeConviction,
        latencyAlphaRace,
        walkForwardRobustness,
        executionPlaybook,
      }),
    [best, edgeConviction, executionPlaybook, latencyAlphaRace, riskGovernor, walkForwardRobustness],
  );
  const sequentialExecutionTest = useMemo(
    () =>
      buildSequentialExecutionTest({
        decision: best,
        edgeConviction,
        latencyAlphaRace,
        hawkesFlowShock,
        liquidityMirage,
        riskGovernor,
        walkForwardRobustness,
        causalExecutionGraph,
      }),
    [
      best,
      causalExecutionGraph,
      edgeConviction,
      hawkesFlowShock,
      latencyAlphaRace,
      liquidityMirage,
      riskGovernor,
      walkForwardRobustness,
    ],
  );
  const executionTournament = useMemo(
    () =>
      buildExecutionTournament({
        replay: historicalReplay,
        walkForwardRobustness,
        sequentialExecutionTest,
        liveDecisionAvailable: Boolean(best),
      }),
    [best, historicalReplay, sequentialExecutionTest, walkForwardRobustness],
  );
  const arbitrageGraph = useMemo(
    () =>
      buildCrossVenueArbitrageGraph({
        liquidityRadar,
        triangularLab,
        mexicoCorridor,
      }),
    [liquidityRadar, mexicoCorridor, triangularLab],
  );
  const challengeEvidence = useMemo(
    () =>
      buildChallengeEvidence({
        decision: best,
        scorecard,
        governor: riskGovernor,
        stressResults,
        marketContext,
        cashCarryLab,
        settlementRisk,
        derivativesPressure,
        historicalReplay,
        venueIntelligence,
        liquidityRadar,
        liquidityTopology,
        mexicoCorridor,
        optionsIv,
        priceConsensus,
        usdtBasis,
        venueLatency,
        leadLag,
        venueReliability,
        venueFailureWarGame,
        smartOrderRouter,
        queuePosition,
        latencyAlphaRace,
        hawkesFlowShock,
        liquidityMirage,
        opportunityHeatmap,
        walkForwardRobustness,
        regimeBreakLab,
        conformalGuard,
        optimalStoppingFrontier,
        executionPlaybook,
        causalExecutionGraph,
        sequentialExecutionTest,
        executionTournament,
        executionRegime,
        capitalOptimizer,
        arbitrageGraph,
        triangularLab,
        liveBooks: books.length,
        enabledVenues: enabled.length,
        health,
        recent,
        trades,
      }),
    [
      best,
      books.length,
      capitalOptimizer,
      cashCarryLab,
      causalExecutionGraph,
      derivativesPressure,
      enabled.length,
      executionPlaybook,
      executionRegime,
      executionTournament,
      arbitrageGraph,
      conformalGuard,
      optimalStoppingFrontier,
      health,
      historicalReplay,
      hawkesFlowShock,
      latencyAlphaRace,
      leadLag,
      liquidityRadar,
      liquidityTopology,
      liquidityMirage,
      marketContext,
      mexicoCorridor,
      opportunityHeatmap,
      optionsIv,
      priceConsensus,
      queuePosition,
      recent,
      regimeBreakLab,
      riskGovernor,
      scorecard,
      settlementRisk,
      sequentialExecutionTest,
      smartOrderRouter,
      stressResults,
      trades,
      triangularLab,
      usdtBasis,
      venueFailureWarGame,
      venueIntelligence,
      venueLatency,
      venueReliability,
      walkForwardRobustness,
    ],
  );
  const evidenceNavigator = useMemo(
    () => buildEvidenceNavigator({ evidence: challengeEvidence, maxRouteSeconds: 90 }),
    [challengeEvidence],
  );
  const dataReadiness = useMemo(() => {
    const restOracles = [
      marketContext,
      cashCarryLab,
      settlementRisk,
      derivativesPressure,
      optionsIv,
      venueIntelligence,
      liquidityRadar,
      mexicoCorridor,
      priceConsensus,
      usdtBasis,
      tradeTape,
      leadLag,
      venueLatency,
      venueReliability,
      triangularLab,
      historicalReplay,
    ];
    return buildDataReadinessRail({
      enabledVenues: enabled.length,
      liveBooks: books.length,
      liveFeeds: health.filter((item) => item.status === "live").length,
      restReady: restOracles.filter(Boolean).length,
      restTotal: restOracles.length,
      publicSources: backendEvidence.health?.publicSourceCount ?? publicSourceCount,
      replayTrades: historicalReplay?.trades.length ?? 0,
      currentRoute: Boolean(currentBest),
      routeState,
      routeMessage,
    });
  }, [
    backendEvidence.health?.publicSourceCount,
    books.length,
    cashCarryLab,
    currentBest,
    derivativesPressure,
    enabled.length,
    health,
    historicalReplay,
    leadLag,
    liquidityRadar,
    marketContext,
    mexicoCorridor,
    optionsIv,
    priceConsensus,
    routeMessage,
    routeState,
    publicSourceCount,
    settlementRisk,
    tradeTape,
    triangularLab,
    usdtBasis,
    venueIntelligence,
    venueLatency,
    venueReliability,
  ]);
  const visiblePublicSourceCount = Math.max(publicSourceCount, backendEvidence.health?.publicSourceCount ?? 0);

  function toggleExchange(exchangeId: ExchangeId) {
    setEnabled((current) =>
      current.includes(exchangeId)
        ? current.filter((item) => item !== exchangeId)
        : [...current, exchangeId],
    );
  }

  function runLiveFeeds() {
    refreshPublicData();
    startLive(enabled, effectiveConfig, defaultWallets);
  }

  function runReplayMode() {
    refreshPublicData();
    replay(effectiveConfig, defaultWallets);
  }

  useEffect(() => {
    function onPanelAction(event: Event) {
      const action = (event as CustomEvent<DashboardPanelAction>).detail;
      if (action === "live") {
        runLiveFeeds();
      }
      if (action === "replay") {
        runReplayMode();
      }
      if (action === "backend") {
        setActiveView("backend");
      }
    }

    window.addEventListener("arbx:panel-action", onPanelAction);
    return () => window.removeEventListener("arbx:panel-action", onPanelAction);
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 lg:px-6">
        <MissionControl
          activeView={activeView}
          acceptedCount={acceptedCount}
          best={best}
          currentBest={currentBest}
          latestDecision={latestDecision}
          booksCount={books.length}
          challengeEvidence={challengeEvidence}
          cumulativePnl={cumulativePnl}
          enabledCount={enabled.length}
          evidenceNavigator={evidenceNavigator}
          mode={mode}
          publicSourceCount={visiblePublicSourceCount}
          rejectedCount={rejectedCount}
          riskGovernor={riskGovernor}
          setActiveView={setActiveView}
          startLive={runLiveFeeds}
          startReplay={runReplayMode}
          stop={stop}
          clearSession={clearSession}
          health={health}
          lastEngineTickAt={lastEngineTickAt}
          routeFreshnessMs={routeFreshnessMs}
          routeState={routeState}
          routeMessage={routeMessage}
        />

        <DataReadinessRail
          items={dataReadiness}
          onOpenBackend={() => setActiveView("backend")}
          onStartLive={runLiveFeeds}
          onStartReplay={runReplayMode}
        />

        <ActiveViewBrief
          activeView={activeView}
          evidenceNavigator={evidenceNavigator}
          onNavigate={setActiveView}
        />

        {activeView === "cockpit" && (
          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel title="Live Exchange Matrix" action={<RadioTower size={16} className="text-zinc-500" />}>
              <ExchangeMatrix
                books={books}
                enabled={enabled}
                health={health}
                onToggleExchange={toggleExchange}
              />
            </Panel>

            <Panel title="Best Route" action={<Activity size={16} className="text-zinc-500" />}>
              <DecisionView decision={best} />
            </Panel>
          </section>
        )}

        {activeView === "quant" && (
          <div className="space-y-4">
            <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Panel title="Market Intelligence" action={<BarChart3 size={16} className="text-zinc-500" />}>
                <MarketContextView context={marketContext} />
              </Panel>
              <Panel title="Execution Probability & Impact">
                <QuantLab decision={best} context={marketContext} />
              </Panel>
            </section>
            <Panel title="Trade Tape Toxicity" action={<Activity size={16} className="text-zinc-500" />}>
              <TradeTapeToxicityView tape={tradeTape} />
            </Panel>
            <Panel title="Hawkes Flow Shock Oracle" action={<Activity size={16} className="text-zinc-500" />}>
              <HawkesFlowShockView oracle={hawkesFlowShock} />
            </Panel>
            <Panel title="Latency Alpha Race Simulator" action={<RadioTower size={16} className="text-zinc-500" />}>
              <LatencyAlphaRaceView race={latencyAlphaRace} />
            </Panel>
            <Panel title="Optimal Stopping Frontier" action={<LineChart size={16} className="text-zinc-500" />}>
              <OptimalStoppingFrontierView frontier={optimalStoppingFrontier} />
            </Panel>
            <Panel title="Queue Position Oracle" action={<Activity size={16} className="text-zinc-500" />}>
              <QueuePositionOracleView oracle={queuePosition} />
            </Panel>
            <Panel title="Liquidity Mirage Detector" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <LiquidityMirageDetectorView detector={liquidityMirage} />
            </Panel>
            <Panel title="Lead-Lag Execution Oracle" action={<RadioTower size={16} className="text-zinc-500" />}>
              <LeadLagOracleView oracle={leadLag} />
            </Panel>
            <Panel title="Derivatives Pressure Oracle" action={<Gauge size={16} className="text-zinc-500" />}>
              <DerivativesPressureOracleView oracle={derivativesPressure} />
            </Panel>
            <Panel title="Cash-and-Carry Lab" action={<Trophy size={16} className="text-zinc-500" />}>
              <CashCarryLabView lab={cashCarryLab} />
            </Panel>
            <Panel title="Options Implied Volatility Oracle" action={<LineChart size={16} className="text-zinc-500" />}>
              <OptionsIvOracleView oracle={optionsIv} />
            </Panel>
          </div>
        )}

        {activeView === "market" && (
          <div className="space-y-4">
            <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Panel title="Venue Quality Radar" action={<BarChart3 size={16} className="text-zinc-500" />}>
                <VenueQualityView intelligence={venueIntelligence} />
              </Panel>
              <Panel title="Market-Wide Route Candidates" action={<Activity size={16} className="text-zinc-500" />}>
                <VenueRoutesView intelligence={venueIntelligence} best={best} />
              </Panel>
            </section>
            <Panel title="Global Liquidity Radar" action={<Database size={16} className="text-zinc-500" />}>
              <LiquidityRadarView radar={liquidityRadar} />
            </Panel>
            <Panel title="Liquidity Topology Map" action={<Network size={16} className="text-zinc-500" />}>
              <LiquidityTopologyView map={liquidityTopology} />
            </Panel>
            <Panel title="Cross-Venue Arbitrage Graph" action={<Network size={16} className="text-zinc-500" />}>
              <ArbitrageGraphView graph={arbitrageGraph} />
            </Panel>
            <Panel title="Smart Order Router" action={<Activity size={16} className="text-zinc-500" />}>
              <SmartOrderRouterView plan={smartOrderRouter} />
            </Panel>
            <Panel title="Venue Reliability Oracle" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <VenueReliabilityOracleView oracle={venueReliability} />
            </Panel>
            <Panel title="Price Consensus Oracle" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <PriceConsensusOracleView oracle={priceConsensus} />
            </Panel>
            <Panel title="USDT Basis Oracle" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <UsdtBasisOracleView oracle={usdtBasis} />
            </Panel>
          </div>
        )}

        {activeView === "backend" && (
          <BackendEvidenceView evidence={backendEvidence} />
        )}

        {activeView === "mexico" && (
          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Panel title="Mexico Corridor Books" action={<MapPin size={16} className="text-zinc-500" />}>
              <MexicoCorridorBooksView lab={mexicoCorridor} />
            </Panel>
            <Panel title="Cross-Currency Route Simulator" action={<Activity size={16} className="text-zinc-500" />}>
              <MexicoCorridorRoutesView lab={mexicoCorridor} />
            </Panel>
          </section>
        )}

        {activeView === "triangular" && (
          <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <Panel title="Coinbase Triangular Books" action={<Database size={16} className="text-zinc-500" />}>
              <TriangularBooksView lab={triangularLab} />
            </Panel>
            <Panel title="Triangular Route Simulator" action={<Activity size={16} className="text-zinc-500" />}>
              <TriangularRoutesView lab={triangularLab} />
            </Panel>
          </section>
        )}

        {activeView === "backtest" && (
          <div className="space-y-4">
            <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Panel title="Historical Replay Summary" action={<LineChart size={16} className="text-zinc-500" />}>
                <HistoricalReplayView replay={historicalReplay} />
              </Panel>
              <Panel title="Historical Simulated Trades">
                <HistoricalTradesView replay={historicalReplay} />
              </Panel>
            </section>
            <Panel title="Strategy Arena" action={<Trophy size={16} className="text-zinc-500" />}>
              <StrategyArena replay={historicalReplay} />
            </Panel>
            <Panel title="Historical Opportunity Heatmap" action={<BarChart3 size={16} className="text-zinc-500" />}>
              <OpportunityHeatmapView heatmap={opportunityHeatmap} />
            </Panel>
            <Panel title="Walk-Forward Robustness Lab" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <WalkForwardRobustnessView lab={walkForwardRobustness} />
            </Panel>
            <Panel title="Bayesian Regime Break Detector" action={<Activity size={16} className="text-zinc-500" />}>
              <BayesianRegimeBreakView lab={regimeBreakLab} />
            </Panel>
            <Panel title="Conformal Execution Guard" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <ConformalExecutionGuardView guard={conformalGuard} />
            </Panel>
            <Panel title="Execution Tournament & Regret Lab" action={<Trophy size={16} className="text-zinc-500" />}>
              <ExecutionTournamentView tournament={executionTournament} />
            </Panel>
            <Panel title="Sensitivity Surface" action={<BarChart3 size={16} className="text-zinc-500" />}>
              <SensitivitySurfaceView replay={historicalReplay} />
            </Panel>
            <Panel title="Stat-Arb Signal" action={<Activity size={16} className="text-zinc-500" />}>
              <StatArbSignalView replay={historicalReplay} />
            </Panel>
          </div>
        )}

        {activeView === "judge" && (
          <div className="space-y-4">
            <Panel title="90-Second Demo Director" action={<ClipboardCheck size={16} className="text-zinc-500" />}>
              <DemoDirectorView evidence={challengeEvidence} onNavigate={setActiveView} />
            </Panel>
            <Panel title="Evidence Navigator" action={<ClipboardCheck size={16} className="text-zinc-500" />}>
              <EvidenceNavigatorView navigator={evidenceNavigator} onNavigate={setActiveView} />
            </Panel>
            <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <Panel title="Challenge Scorecard" action={<Trophy size={16} className="text-zinc-500" />}>
                <JudgeScorecardView scorecard={scorecard} />
              </Panel>
              <Panel title="Stress Lab" action={<ShieldCheck size={16} className="text-zinc-500" />}>
                <StressLab decision={best} stressResults={stressResults} />
              </Panel>
            </section>
            <Panel title="Risk Governor & Circuit Breaker" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <RiskGovernorView governor={riskGovernor} />
            </Panel>
            <Panel title="Settlement Risk Oracle" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <SettlementRiskOracleView oracle={settlementRisk} />
            </Panel>
            <Panel title="Bayesian Edge Conviction" action={<Activity size={16} className="text-zinc-500" />}>
              <EdgeConvictionView conviction={edgeConviction} />
            </Panel>
            <Panel title="Latency Alpha Race Simulator" action={<RadioTower size={16} className="text-zinc-500" />}>
              <LatencyAlphaRaceView race={latencyAlphaRace} compact />
            </Panel>
            <Panel title="Optimal Stopping Frontier" action={<LineChart size={16} className="text-zinc-500" />}>
              <OptimalStoppingFrontierView frontier={optimalStoppingFrontier} compact />
            </Panel>
            <Panel title="Autonomous Execution Playbook" action={<ClipboardCheck size={16} className="text-zinc-500" />}>
              <ExecutionPlaybookView playbook={executionPlaybook} />
            </Panel>
            <Panel title="Causal Execution Evidence Graph" action={<Activity size={16} className="text-zinc-500" />}>
              <CausalExecutionGraphView graph={causalExecutionGraph} />
            </Panel>
            <Panel title="Cross-Venue Arbitrage Graph" action={<Network size={16} className="text-zinc-500" />}>
              <ArbitrageGraphView graph={arbitrageGraph} compact />
            </Panel>
            <Panel title="Liquidity Topology Map" action={<Network size={16} className="text-zinc-500" />}>
              <LiquidityTopologyView map={liquidityTopology} compact />
            </Panel>
            <Panel title="Sequential Execution Test" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <SequentialExecutionTestView test={sequentialExecutionTest} />
            </Panel>
            <Panel title="Historical Opportunity Heatmap" action={<BarChart3 size={16} className="text-zinc-500" />}>
              <OpportunityHeatmapView heatmap={opportunityHeatmap} compact />
            </Panel>
            <Panel title="Walk-Forward Robustness Lab" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <WalkForwardRobustnessView lab={walkForwardRobustness} compact />
            </Panel>
            <Panel title="Bayesian Regime Break Detector" action={<Activity size={16} className="text-zinc-500" />}>
              <BayesianRegimeBreakView lab={regimeBreakLab} compact />
            </Panel>
            <Panel title="Conformal Execution Guard" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <ConformalExecutionGuardView guard={conformalGuard} compact />
            </Panel>
            <Panel title="Execution Tournament & Regret Lab" action={<Trophy size={16} className="text-zinc-500" />}>
              <ExecutionTournamentView tournament={executionTournament} compact />
            </Panel>
            <Panel title="Execution Regime Fusion" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <ExecutionRegimeFusionView fusion={executionRegime} />
            </Panel>
            <Panel title="Lead-Lag Execution Oracle" action={<RadioTower size={16} className="text-zinc-500" />}>
              <LeadLagOracleView oracle={leadLag} compact />
            </Panel>
            <Panel title="Capital Allocation Optimizer" action={<Trophy size={16} className="text-zinc-500" />}>
              <CapitalAllocationOptimizerView optimizer={capitalOptimizer} />
            </Panel>
            <Panel title="Smart Order Router" action={<Activity size={16} className="text-zinc-500" />}>
              <SmartOrderRouterView plan={smartOrderRouter} compact />
            </Panel>
            <Panel title="Queue Position Oracle" action={<Activity size={16} className="text-zinc-500" />}>
              <QueuePositionOracleView oracle={queuePosition} compact />
            </Panel>
            <Panel title="Hawkes Flow Shock Oracle" action={<Activity size={16} className="text-zinc-500" />}>
              <HawkesFlowShockView oracle={hawkesFlowShock} compact />
            </Panel>
            <Panel title="Liquidity Mirage Detector" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <LiquidityMirageDetectorView detector={liquidityMirage} compact />
            </Panel>
            <Panel title="Institutional Carry Simulator" action={<Trophy size={16} className="text-zinc-500" />}>
              <CashCarryLabView lab={cashCarryLab} compact />
            </Panel>
            <Panel title="Engine Throughput Lab" action={<Gauge size={16} className="text-zinc-500" />}>
              <EngineThroughputLabView lab={throughputLab} />
            </Panel>
            <Panel title="Venue Latency Race" action={<RadioTower size={16} className="text-zinc-500" />}>
              <VenueLatencyRaceView race={venueLatency} />
            </Panel>
            <Panel title="Venue Reliability Oracle" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <VenueReliabilityOracleView oracle={venueReliability} compact />
            </Panel>
            <Panel title="Venue Failure War Game" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <VenueFailureWarGameView game={venueFailureWarGame} compact />
            </Panel>
            <Panel title="Decision Audit Receipt" action={<Fingerprint size={16} className="text-zinc-500" />}>
              <DecisionAuditReceiptView evidence={challengeEvidence} />
            </Panel>
          </div>
        )}

        {activeView === "replay" && (
          <>
            <section className="grid gap-4 xl:grid-cols-3">
              <Panel title="Wallet Inventory">
                <WalletTable wallets={wallets} />
              </Panel>
              <Panel title="P&L Curve">
                <PnlChart trades={trades} />
              </Panel>
              <Panel title="Engine Health" action={<Database size={16} className="text-zinc-500" />}>
                <div className="space-y-2">
                  {enabled.map((exchangeId) => {
                    const item = health.find((entry) => entry.exchangeId === exchangeId);
                    return (
                      <div key={exchangeId} className="flex items-center justify-between gap-3 text-sm">
                        <span className="capitalize text-zinc-300">{exchangeId}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">{Math.round(item?.latencyMs ?? 0)}ms</span>
                          <Badge tone={healthTone(item?.status)}>{item?.status ?? "idle"}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </section>
            <Panel title="Capital Rebalance Planner" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <RebalancePlannerView planner={rebalancePlanner} />
            </Panel>
            <Panel title="Settlement Risk Oracle" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <SettlementRiskOracleView oracle={settlementRisk} />
            </Panel>
            <Panel title="Venue Failure War Game" action={<ShieldCheck size={16} className="text-zinc-500" />}>
              <VenueFailureWarGameView game={venueFailureWarGame} />
            </Panel>
            <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Panel title="Rejected Opportunities">
                <div className="max-h-[330px] space-y-2 overflow-auto pr-1">
                  {recent.filter((item) => item.status === "rejected").slice(0, 12).map((item, index) => (
                    <DecisionLine key={`${item.id}-${index}`} decision={item} />
                  ))}
                  {recent.filter((item) => item.status === "rejected").length === 0 && (
                    <EmptyState text="No rejected opportunities yet. Start live feeds or replay." />
                  )}
                </div>
              </Panel>
              <Panel title="Replay Timeline">
                <div className="max-h-[330px] space-y-2 overflow-auto pr-1">
                  {recent.slice(0, 16).map((item, index) => (
                    <DecisionLine key={`${item.id}-${index}`} decision={item} />
                  ))}
                  {recent.length === 0 && <EmptyState text="The event journal will populate here." />}
                </div>
              </Panel>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function DataReadinessRail({
  items,
  onOpenBackend,
  onStartLive,
  onStartReplay,
}: {
  items: DataReadinessItem[];
  onOpenBackend: () => void;
  onStartLive: () => void;
  onStartReplay: () => void;
}) {
  return (
    <section className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Data readiness">
      {items.map((item) => (
        <Card key={item.id} className="min-w-0 border-zinc-800 bg-zinc-950/90">
          <CardHeader className="min-w-0 pb-2">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <CardDescription className="truncate uppercase">{item.label}</CardDescription>
              <Badge tone={item.tone}>{item.value}</Badge>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            <Progress value={item.progress} />
            <p className="mt-2 text-xs leading-5 text-zinc-400">{item.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.id === "live" && (
                <Button
                  className="h-auto min-h-8 whitespace-normal text-left leading-4"
                  onClick={onStartLive}
                  size="sm"
                  type="button"
                  variant={item.progress >= 100 ? "ghost" : "outline"}
                >
                  <Play size={14} aria-hidden="true" />
                  Start live feeds
                </Button>
              )}
              {item.id === "replay" && (
                <Button
                  className="h-auto min-h-8 whitespace-normal text-left leading-4"
                  onClick={onStartReplay}
                  size="sm"
                  type="button"
                  variant={item.progress >= 100 ? "ghost" : "outline"}
                >
                  <History size={14} aria-hidden="true" />
                  Run replay
                </Button>
              )}
              {item.id === "rest" && (
                <Button
                  className="h-auto min-h-8 whitespace-normal text-left leading-4"
                  onClick={onOpenBackend}
                  size="sm"
                  type="button"
                  variant={item.progress >= 100 ? "ghost" : "outline"}
                >
                  <Database size={14} aria-hidden="true" />
                  Backend evidence
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function MissionControl({
  activeView,
  acceptedCount,
  best,
  currentBest,
  latestDecision,
  booksCount,
  challengeEvidence,
  cumulativePnl,
  enabledCount,
  evidenceNavigator,
  mode,
  publicSourceCount,
  rejectedCount,
  riskGovernor,
  setActiveView,
  startLive,
  startReplay,
  stop,
  clearSession,
  health,
  lastEngineTickAt,
  routeFreshnessMs,
  routeState,
  routeMessage,
}: {
  activeView: DashboardView;
  acceptedCount: number;
  best?: OpportunityDecision;
  currentBest?: OpportunityDecision;
  latestDecision?: OpportunityDecision;
  booksCount: number;
  challengeEvidence: ChallengeEvidence;
  cumulativePnl: number;
  enabledCount: number;
  evidenceNavigator: EvidenceNavigator;
  mode: string;
  publicSourceCount: number;
  rejectedCount: number;
  riskGovernor: RiskGovernor;
  setActiveView: (view: DashboardView) => void;
  startLive: () => void;
  startReplay: () => void;
  stop: () => void;
  clearSession: () => void;
  health: FeedHealth[];
  lastEngineTickAt?: number;
  routeFreshnessMs?: number;
  routeState: "current-route" | "no-current-route" | "empty";
  routeMessage: string;
}) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [actionReceipt, setActionReceipt] = useState<{
    label: string;
    detail: string;
    at?: number;
  }>({
    label: "Idle",
    detail: "Choose Live feeds for public WebSockets or Replay for deterministic evidence.",
  });
  const [actionPhase, setActionPhase] = useState<"idle" | "starting" | "live" | "replay" | "stopped" | "cleared">("idle");
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const verdictTone =
    challengeEvidence.verdict === "national-final-ready"
      ? "green"
      : challengeEvidence.verdict === "demo-ready"
        ? "cyan"
        : "amber";
  const governorTone =
    riskGovernor.state === "normal"
      ? "green"
      : riskGovernor.state === "caution"
        ? "amber"
        : "red";
  const bestRoute = currentBest ? `${currentBest.buyExchange} -> ${currentBest.sellExchange}` : "no executable route now";
  const routeTone = routeState === "current-route" ? "green" : routeState === "no-current-route" ? "amber" : "neutral";
  const routePreview = evidenceNavigator.highImpactRoute.slice(0, 4);
  const liveFeeds = health.filter((item) => item.status === "live").length;
  const socketFeeds = health.filter((item) => item.transport === "websocket" && item.status === "live").length;
  const fallbackFeeds = health.filter((item) => item.snapshotFallback === "loaded").length;
  const lastProblem = [...health]
    .reverse()
    .find((item) => item.status === "error" || item.status === "stale" || item.lastRejectReason);
  const lastProblemLabel = lastProblem
    ? `${lastProblem.exchangeId}: ${lastProblem.lastRejectReason ?? lastProblem.message ?? "feed not ready"}`
    : "no feed errors reported";

  function receipt(label: string, detail: string) {
    setActionReceipt({ label, detail, at: Date.now() });
  }

  function runLive() {
    setActionPhase("starting");
    startLive();
    window.setTimeout(() => setActionPhase("live"), 350);
    receipt("Live feeds started", `Opening ${enabledCount} public WebSocket venues with REST bootstrap where available.`);
  }

  function runReplay() {
    setActionPhase("replay");
    startReplay();
    receipt("Replay loaded", "Live sockets are stopped; deterministic replay data is now driving the simulation.");
  }

  function runStop() {
    setActionPhase("stopped");
    stop();
    receipt("Feeds stopped", "Sockets and reconnect timers are closed; the last books and decisions remain visible as evidence.");
  }

  function runClear() {
    setActionPhase("cleared");
    clearSession();
    receipt("Session cleared", "Books, health, trades, wallets, and replay decisions were reset.");
  }

  return (
    <div className="space-y-3">
      <CommandPalette
        evidence={challengeEvidence}
        navigator={evidenceNavigator}
        onNavigate={setActiveView}
        open={commandOpen}
        setOpen={setCommandOpen}
      />
      <Card className="overflow-hidden border-zinc-800 bg-zinc-950/95">
        <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
          <div className="p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">Simulation only</Badge>
              <Badge tone={mode === "live" ? "green" : mode === "replay" ? "amber" : "neutral"}>{mode}</Badge>
              <Badge tone={verdictTone}>{challengeEvidence.verdict}</Badge>
              <Badge tone="neutral">{publicSourceCount} public sources</Badge>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end">
              <div>
                <h1 className="text-3xl font-semibold tracking-normal text-white lg:text-4xl">
                  ArbX-Ray Execution Lab
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                  Browser-first execution engine plus serverless backend adapters for real public Bitcoin market data:
                  L2 books, simulated fills, wallet constraints, replay evidence, and judge-ready quant proofs.
                </p>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase text-zinc-500">Readiness</span>
                  <span className="text-2xl font-semibold tabular-nums text-white">
                    {challengeEvidence.readinessScore}/100
                  </span>
                </div>
                <Progress value={challengeEvidence.readinessScore} className="mt-3" />
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>Coverage {evidenceNavigator.summary.coveragePct}%</span>
                  <span>{evidenceNavigator.summary.highImpactTimeSeconds}s demo path</span>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase text-zinc-500">Execution Mode Bar</div>
                  <div className="mt-1 text-sm text-zinc-300">
                    {actionReceipt.label}
                    {actionReceipt.at ? (
                      <span className="text-zinc-500"> · {new Date(actionReceipt.at).toLocaleTimeString()}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={actionPhase === "live" ? "green" : actionPhase === "replay" ? "amber" : "neutral"}>{actionPhase}</Badge>
                  <Badge tone="neutral">{liveFeeds}/{enabledCount} live</Badge>
                  <Badge tone={fallbackFeeds > 0 ? "cyan" : "neutral"}>{fallbackFeeds} REST fallback</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Tooltip label="Connects selected public WebSocket feeds, bootstraps REST snapshots, starts the worker, wallets, and continuous route evaluation.">
                  <Button variant="primary" onClick={runLive} disabled={mode === "live" || actionPhase === "starting"}>
                    <Play size={16} /> Live feeds
                  </Button>
                </Tooltip>
                <Tooltip label="Stops live networking and loads a deterministic scenario so judges can inspect one full execution decision even if a venue is unavailable.">
                  <Button variant="outline" onClick={runReplay} disabled={mode === "replay"}>
                    <History size={16} /> Replay
                  </Button>
                </Tooltip>
                <Tooltip label="Closes sockets and reconnect timers while preserving the last books, trades, rejects, and P&L on screen.">
                  <Button variant="danger" onClick={runStop} disabled={mode === "idle"}>
                    <Square size={16} /> Stop feeds
                  </Button>
                </Tooltip>
                <Tooltip label="Clears the current evidence session. Use this only when starting a fresh demo run.">
                  <Button variant="outline" onClick={runClear}>
                    <RotateCcw size={16} /> Clear session
                  </Button>
                </Tooltip>
              <Tooltip label="Open the judge evidence board with scorecard, proof route, and audit receipt.">
                <Button variant="ghost" onClick={() => setActiveView("judge")}>
                  <Trophy size={16} /> Judge board
                </Button>
              </Tooltip>
              <Tooltip label="Search views, criteria, proof steps, and judge evidence.">
                <Button variant="ghost" onClick={() => setCommandOpen(true)}>
                  <Search size={16} /> Find proof <Kbd>Ctrl K</Kbd>
                </Button>
              </Tooltip>
              </div>
              <Alert className="mt-3 border-zinc-800 bg-zinc-950/70">
                <AlertTitle>Last action receipt</AlertTitle>
                <AlertDescription>
                  {actionReceipt.detail} Live sockets: {socketFeeds}. Last feed issue: {lastProblemLabel}. Route state: {routeMessage}
                </AlertDescription>
              </Alert>
            </div>
          </div>
          <div className="border-t border-zinc-800 bg-zinc-900/40 p-4 xl:border-l xl:border-t-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase text-zinc-500">Command route</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{bestRoute}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Badge tone={routeTone}>{routeState}</Badge>
                <Badge tone={governorTone}>{riskGovernor.state}</Badge>
              </div>
            </div>
            <div className="mb-3 rounded border border-zinc-800 bg-zinc-950 p-2 text-xs leading-5 text-zinc-400">
              {routeMessage}
              {routeFreshnessMs !== undefined ? ` Fresh ${routeFreshnessMs}ms.` : ""}
              {lastEngineTickAt ? ` Tick ${new Date(lastEngineTickAt).toLocaleTimeString()}.` : ""}
              {!currentBest && latestDecision ? ` Last journal: ${latestDecision.buyExchange} -> ${latestDecision.sellExchange}.` : ""}
            </div>
            <Separator />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MissionKpiCard label="Net P&L" value={money.format(cumulativePnl)} tone={cumulativePnl >= 0 ? "green" : "red"} />
              <MissionKpiCard label="Books" value={`${booksCount}/${enabledCount}`} tone={booksCount >= 2 ? "green" : "amber"} />
              <MissionKpiCard label="Accepted" value={String(acceptedCount)} tone="cyan" />
              <MissionKpiCard label="Rejected" value={String(rejectedCount)} tone="amber" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Compass size={16} className="text-cyan-300" /> Workspace Navigation
                </CardTitle>
                <CardDescription>Tabs are ordered like a judge walkthrough: operate, prove, expand, replay, close.</CardDescription>
              </div>
              <Badge tone="neutral">{activeView}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Dashboard views">
              <ViewButton active={activeView === "cockpit"} onClick={() => setActiveView("cockpit")}>
                <RadioTower size={15} /> Cockpit
              </ViewButton>
              <ViewButton active={activeView === "quant"} onClick={() => setActiveView("quant")}>
                <Gauge size={15} /> Quant Lab
              </ViewButton>
              <ViewButton active={activeView === "market"} onClick={() => setActiveView("market")}>
                <BarChart3 size={15} /> Market Map
              </ViewButton>
              <ViewButton active={activeView === "backend"} onClick={() => setActiveView("backend")}>
                <Database size={15} /> Backend Evidence
              </ViewButton>
              <ViewButton active={activeView === "mexico"} onClick={() => setActiveView("mexico")}>
                <MapPin size={15} /> Mexico Corridor
              </ViewButton>
              <ViewButton active={activeView === "triangular"} onClick={() => setActiveView("triangular")}>
                <Activity size={15} /> Triangular Lab
              </ViewButton>
              <ViewButton active={activeView === "backtest"} onClick={() => setActiveView("backtest")}>
                <LineChart size={15} /> Historical Replay
              </ViewButton>
              <ViewButton active={activeView === "judge"} onClick={() => setActiveView("judge")}>
                <Trophy size={15} /> Judge Mode
              </ViewButton>
              <ViewButton active={activeView === "replay"} onClick={() => setActiveView("replay")}>
                <History size={15} /> Replay & Risk
              </ViewButton>
            </nav>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Rocket size={16} className="text-emerald-300" /> 70s Judge Path
                </CardTitle>
                <CardDescription>Highest-impact route generated from current evidence.</CardDescription>
              </div>
              <Badge tone="cyan">{routePreview.length} stops</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {routePreview.map((item, index) => (
              <button
                key={item.step.id}
                onClick={() => setActiveView(item.step.view)}
                className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded border border-zinc-800 bg-zinc-900/70 p-2 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-xs text-zinc-300">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-100">{item.step.label}</span>
                  <span className="block truncate text-xs text-zinc-500">{item.step.kpi}</span>
                </span>
                <Badge tone="neutral">{item.step.timeboxSeconds}s</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers3 size={16} className="text-amber-300" /> Challenge Coverage
              </CardTitle>
              <CardDescription>Every criterion from the challenge is visible before the first scroll.</CardDescription>
            </div>
            <Badge tone={evidenceNavigator.navigationGaps.length === 0 ? "green" : "amber"}>
              {evidenceNavigator.navigationGaps.length === 0 ? "no gaps" : `${evidenceNavigator.navigationGaps.length} watch`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ChallengeCoverageDrilldown
            evidence={challengeEvidence}
            navigator={evidenceNavigator}
            onNavigate={setActiveView}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function CommandPalette({
  evidence,
  navigator,
  onNavigate,
  open,
  setOpen,
}: {
  evidence: ChallengeEvidence;
  navigator: EvidenceNavigator;
  onNavigate: (view: DashboardView) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const viewItems = useMemo(
    () =>
      [
        { view: "cockpit" as DashboardView, label: "Cockpit", description: "Live exchange matrix and best route" },
        { view: "quant" as DashboardView, label: "Quant Lab", description: "Probability, latency, flow, options, carry" },
        { view: "market" as DashboardView, label: "Market Map", description: "Liquidity radar, topology, SOR, venue reliability" },
        { view: "backend" as DashboardView, label: "Backend Evidence", description: "Route handlers, manifest, health, public API adapters" },
        { view: "mexico" as DashboardView, label: "Mexico Corridor", description: "Bitso BTC/MXN and USD/MXN route simulator" },
        { view: "triangular" as DashboardView, label: "Triangular Lab", description: "Coinbase BTC/ETH/USD cycle simulator" },
        { view: "backtest" as DashboardView, label: "Historical Replay", description: "Real candle replay and robustness labs" },
        { view: "judge" as DashboardView, label: "Judge Mode", description: "Scorecard, evidence navigator, audit receipt" },
        { view: "replay" as DashboardView, label: "Replay & Risk", description: "Wallets, P&L, rejections, settlement risk" },
      ],
    [],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (text: string) => !normalizedQuery || text.toLowerCase().includes(normalizedQuery);
  const filteredViews = viewItems.filter((item) => matches(`${item.label} ${item.description} ${item.view}`));
  const routeItems = navigator.highImpactRoute.filter((item) => matches(`${item.step.label} ${item.step.kpi} ${item.step.proof} ${item.step.view}`));
  const criterionItems = evidence.criteria.filter((item) => matches(`${item.label} ${item.proof} ${item.nextMove} ${item.status}`));
  const hasResults = filteredViews.length > 0 || routeItems.length > 0 || criterionItems.length > 0;

  function goTo(view: DashboardView) {
    onNavigate(view);
    setOpen(false);
    setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Proof Command Palette <Kbd>Ctrl K</Kbd>
          </DialogTitle>
          <DialogDescription>Search the dashboard by view, challenge criterion, proof step, or quant evidence.</DialogDescription>
        </DialogHeader>
        <Command>
          <div className="border-b border-zinc-800 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <Input
                autoFocus
                className="pl-9"
                placeholder="Search route, latency, topology, conformal, Mexico, audit..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <CommandList>
            {!hasResults && <CommandEmpty>No matching proof or dashboard view.</CommandEmpty>}
            {filteredViews.length > 0 && (
              <CommandGroup heading="Views">
                {filteredViews.map((item) => (
                  <CommandItem key={item.view} onClick={() => goTo(item.view)}>
                    <Compass size={16} className="text-cyan-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-zinc-100">{item.label}</span>
                      <span className="block truncate text-xs text-zinc-500">{item.description}</span>
                    </span>
                    <Badge tone="neutral">{item.view}</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {routeItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="High-impact judge route">
                  {routeItems.map((item) => (
                    <CommandItem key={item.step.id} onClick={() => goTo(item.step.view)}>
                      <Rocket size={16} className="text-emerald-300" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-zinc-100">{item.step.label}</span>
                        <span className="block truncate text-xs text-zinc-500">{item.step.kpi}</span>
                      </span>
                      <Badge tone="cyan">{item.step.timeboxSeconds}s</Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {criterionItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Challenge criteria">
                  {criterionItems.map((item) => (
                    <CommandItem key={item.id} onClick={() => goTo("judge")}>
                      <Trophy size={16} className="text-amber-300" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-zinc-100">{item.label}</span>
                        <span className="block truncate text-xs text-zinc-500">{item.proof}</span>
                      </span>
                      <Badge tone={item.status === "strong" ? "green" : item.status === "watch" ? "amber" : "red"}>{item.score}</Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

const viewMeta: Record<
  DashboardView,
  {
    title: string;
    stage: string;
    description: string;
    judgeValue: string;
  }
> = {
  cockpit: {
    title: "Cockpit",
    stage: "Operate",
    description: "Live/replay execution desk with selected exchanges, same-lane readiness, and the current route decision.",
    judgeValue: "Proves real-time monitoring, execution discipline, wallet constraints, and transparent rejection behavior.",
  },
  quant: {
    title: "Quant Lab",
    stage: "Prove",
    description: "Probability, latency, flow toxicity, maker/taker queue math, derivatives pressure, options IV, and carry signals.",
    judgeValue: "Proves the bot is not just spread chasing; it prices uncertainty, flow, and timing before simulating action.",
  },
  market: {
    title: "Market Map",
    stage: "Expand",
    description: "Cross-venue liquidity radar, topology, smart order routing, reliability, price consensus, and USDT basis.",
    judgeValue: "Proves broad public API coverage, venue quality awareness, and execution depth beyond top-of-book prices.",
  },
  backend: {
    title: "Backend Evidence",
    stage: "Full-stack proof",
    description: "Serverless Next.js Route Handlers, health endpoint, backend manifest, public API adapters, and no-key deployment proof.",
    judgeValue: "Proves the delivery is frontend plus backend without adding paid infrastructure or private exchange credentials.",
  },
  mexico: {
    title: "Mexico Corridor",
    stage: "Local edge",
    description: "BTC/USD to BTC/MXN and executable USD/MXN route simulation using public Bitso and Coinbase data.",
    judgeValue: "Connects the challenge to a Mexico-relevant arbitrage path with real FX depth instead of static conversion.",
  },
  triangular: {
    title: "Triangular Lab",
    stage: "Strategy",
    description: "Single-venue BTC/ETH/USD triangular cycle simulation over real Coinbase L2 depth.",
    judgeValue: "Shows strategy breadth: the system can reason about graph cycles, not only exchange-to-exchange spreads.",
  },
  backtest: {
    title: "Historical Replay",
    stage: "Validate",
    description: "Real candle replay, Strategy Arena, opportunity heatmap, walk-forward robustness, conformal guard, and regret lab.",
    judgeValue: "Proves the strategy has historical evidence, out-of-sample discipline, and finite-sample downside checks.",
  },
  judge: {
    title: "Judge Mode",
    stage: "Present",
    description: "Scorecard, evidence navigator, demo director, audit receipt, and all high-impact proof modules in one flow.",
    judgeValue: "Lets the jury verify every requirement quickly without hunting through the full application.",
  },
  replay: {
    title: "Replay & Risk",
    stage: "Audit",
    description: "Wallet state, P&L curve, rejected opportunities, settlement risk, capital rebalance, and venue failure scenarios.",
    judgeValue: "Shows robustness: bad trades are rejected, balances update, and failure/rebalance costs remain visible.",
  },
};

function ActiveViewBrief({
  activeView,
  evidenceNavigator,
  onNavigate,
}: {
  activeView: DashboardView;
  evidenceNavigator: EvidenceNavigator;
  onNavigate: (view: DashboardView) => void;
}) {
  const meta = viewMeta[activeView];
  const viewGroup = evidenceNavigator.byView.find((item) => item.view === activeView);
  const routeHits = evidenceNavigator.highImpactRoute.filter((item) => item.step.view === activeView);
  const coverageHits = evidenceNavigator.coverage.filter((item) =>
    routeHits.some((route) => route.criteria.includes(item.criterionId)),
  );
  const viewActions = buildViewActions(activeView);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink onClick={() => onNavigate("cockpit")}>ArbX-Ray</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{meta.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <CardTitle className="mt-3 text-base">{meta.stage}: {meta.title}</CardTitle>
            <CardDescription className="mt-1 max-w-4xl">{meta.description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="cyan">{viewGroup?.stepCount ?? 0} proof steps</Badge>
            <Badge tone="neutral">{viewGroup?.totalSeconds ?? 0}s full demo</Badge>
            <Badge tone={routeHits.length > 0 ? "green" : "amber"}>{routeHits.length} fast path</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-[1fr_0.8fr]">
        <Alert tone="cyan">
          <AlertTitle>Judge value</AlertTitle>
          <AlertDescription>{meta.judgeValue}</AlertDescription>
        </Alert>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/70 p-3">
          <div className="mb-2 text-xs uppercase text-zinc-500">Coverage touched by this view</div>
          <div className="flex flex-wrap gap-2">
            {coverageHits.length > 0 ? (
              coverageHits.map((item) => (
                <Badge key={item.criterionId} tone={item.status === "strong" ? "green" : item.status === "watch" ? "amber" : "red"}>
                  {item.criterionId}
                </Badge>
              ))
            ) : (
              <Badge tone="neutral">exploratory proof surface</Badge>
            )}
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase text-zinc-500">Next proof actions</div>
            <Badge tone="neutral">{viewActions.length} guided actions</Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {viewActions.map((action) => (
              <button
                key={`${activeView}-${action.id}`}
                className="grid min-w-0 grid-cols-[auto_1fr] items-start gap-3 rounded-md border border-zinc-800 bg-zinc-900/70 p-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                onClick={() => runViewAction(action, onNavigate)}
                type="button"
              >
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-zinc-300">
                  {viewActionIcon(action)}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">{action.label}</span>
                    <Badge tone={action.kind === "engine" ? "cyan" : "neutral"}>
                      {action.kind === "engine" ? "run" : action.view}
                    </Badge>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">{action.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function runViewAction(action: ViewAction, onNavigate: (view: DashboardView) => void) {
  if (action.kind === "engine") {
    dispatchPanelAction(action.id);
    return;
  }
  onNavigate(action.view);
}

function viewActionIcon(action: ViewAction): ReactNode {
  if (action.id === "live") return <Play size={16} aria-hidden="true" />;
  if (action.id === "replay") return <History size={16} aria-hidden="true" />;
  if (action.id === "backend") return <Database size={16} aria-hidden="true" />;
  if (action.id === "judge") return <Trophy size={16} aria-hidden="true" />;
  if (action.id === "market") return <BarChart3 size={16} aria-hidden="true" />;
  if (action.id === "mexico") return <MapPin size={16} aria-hidden="true" />;
  if (action.id === "backtest") return <LineChart size={16} aria-hidden="true" />;
  if (action.id === "quant") return <Gauge size={16} aria-hidden="true" />;
  return <Compass size={16} aria-hidden="true" />;
}

function MissionKpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "amber" | "cyan" | "neutral";
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase text-zinc-500">{label}</span>
        <Badge tone={tone}>live</Badge>
      </div>
      <div className="mt-2 truncate text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function ChallengeCoverageDrilldown({
  evidence,
  navigator,
  onNavigate,
}: {
  evidence: ChallengeEvidence;
  navigator: EvidenceNavigator;
  onNavigate: (view: DashboardView) => void;
}) {
  return (
    <Accordion defaultValue={navigator.coverage.slice(0, 2).map((criterion) => criterion.criterionId)}>
      {navigator.coverage.map((criterion) => {
        const evidenceCriterion = evidence.criteria.find((item) => item.id === criterion.criterionId);
        return (
          <CriterionAccordionRow
            key={criterion.criterionId}
            criterion={criterion}
            evidenceCriterion={evidenceCriterion}
            onNavigate={onNavigate}
          />
        );
      })}
    </Accordion>
  );
}

function CriterionAccordionRow({
  criterion,
  evidenceCriterion,
  onNavigate,
}: {
  criterion: EvidenceCoverage;
  evidenceCriterion?: ChallengeCriterionEvidence;
  onNavigate: (view: DashboardView) => void;
}) {
  const tone = criterion.status === "strong" ? "green" : criterion.status === "watch" ? "amber" : "red";
  const Icon = criterion.covered ? CheckCircle2 : AlertTriangle;
  return (
    <AccordionItem value={criterion.criterionId}>
      <AccordionTrigger>
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Icon size={16} className={criterion.covered ? "text-emerald-300" : "text-amber-300"} />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{criterion.label}</span>
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              {criterion.stepIds.length} proof step(s) · {criterion.score}/100
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Badge tone={tone}>{criterion.status}</Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="grid gap-3 lg:grid-cols-[1fr_0.55fr]">
          <div className="space-y-3">
            <Progress value={criterion.score} />
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs uppercase text-zinc-500">Proof</div>
              <div className="mt-1 text-sm leading-5 text-zinc-200">
                {evidenceCriterion?.proof ?? "No proof text is available for this criterion yet."}
              </div>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs uppercase text-zinc-500">Best next move</div>
              <div className="mt-1 text-sm leading-5 text-zinc-300">
                {evidenceCriterion?.nextMove ?? "Use Judge Mode to inspect coverage gaps."}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="text-xs uppercase text-zinc-500">Judge actions</div>
            <Button variant="outline" onClick={() => onNavigate("judge")}>
              <Trophy size={16} /> Open Judge Mode
            </Button>
            <Button variant="ghost" onClick={() => onNavigate(recommendedViewForCriterion(criterion.criterionId))}>
              <Compass size={16} /> Open best proof view
            </Button>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge tone={criterion.covered ? "green" : "amber"}>{criterion.covered ? "covered" : "uncovered"}</Badge>
              <Badge tone="neutral">{criterion.stepIds.length} linked steps</Badge>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function recommendedViewForCriterion(criterion: ChallengeCriterionId): DashboardView {
  if (criterion === "speed") return "cockpit";
  if (criterion === "precision") return "quant";
  if (criterion === "robustness") return "replay";
  if (criterion === "strategy") return "market";
  if (criterion === "architecture") return "backend";
  return "judge";
}

function ViewButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-9 w-full items-center gap-2 rounded px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
        active
          ? "border border-zinc-100 bg-zinc-100 text-zinc-950"
          : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function buildAllocationCandidates(input: {
  best?: OpportunityDecision;
  cashCarryLab?: CashCarryLab;
  mexicoCorridor?: MexicoCorridorLab;
  triangularLab?: TriangularLab;
  historicalReplay?: HistoricalReplay;
  liquidityRadar?: LiquidityRadar;
}): AllocationCandidate[] {
  return [
    liveArbCandidate(input.best),
    cashCarryCandidate(input.cashCarryLab),
    mexicoCandidate(input.mexicoCorridor),
    triangularCandidate(input.triangularLab),
    historicalCandidate(input.historicalReplay),
    liquidityCandidate(input.liquidityRadar),
  ];
}

function liveArbCandidate(decision?: OpportunityDecision): AllocationCandidate {
  if (!decision) return missingAllocationCandidate("live-arb", "Live L2 arbitrage", "Waiting for live or replay book route");
  const notionalUsd = Math.max(1, decision.tradeSizeBtc * decision.buyFill.vwap);
  const expectedReturnBps = (decision.netProfitUsd / notionalUsd) * 10_000;
  const latencyRiskBps = (decision.risk.latencyPenaltyUsd / notionalUsd) * 10_000;
  return {
    id: "live-arb",
    label: "Live L2 arbitrage",
    expectedReturnBps,
    riskBps: clampNumber((1 - decision.risk.positivePnlProbability) * 85 + latencyRiskBps, 8, 110),
    confidence:
      decision.status === "accepted"
        ? clampNumber(decision.risk.positivePnlProbability, 0.55, 0.95)
        : clampNumber(decision.risk.positivePnlProbability * 0.8, 0.25, 0.48),
    capacityUsd: Math.min(40_000, notionalUsd),
    sourceCount: 2,
    status: decision.status === "accepted" ? "active" : "rejected",
    evidence: `${decision.buyExchange} -> ${decision.sellExchange}; net ${money.format(decision.netProfitUsd)}`,
  };
}

function cashCarryCandidate(lab?: CashCarryLab): AllocationCandidate {
  if (!lab) return missingAllocationCandidate("cash-carry", "Cash-and-carry basis", "Waiting for public spot/perp basis");
  const route = lab.routes[0];
  if (!route) return missingAllocationCandidate("cash-carry", "Cash-and-carry basis", "No spot/perp route loaded");
  const status = route.action === "open-carry" ? "active" : route.action === "monitor" ? "watch" : "rejected";
  return {
    id: "cash-carry",
    label: "Cash-and-carry basis",
    expectedReturnBps: (route.expectedNetUsd / Math.max(1, lab.notionalUsd)) * 10_000,
    riskBps: clampNumber((route.stressLossUsd / Math.max(1, lab.notionalUsd)) * 4_500 + (route.liquidationBufferPct < 8 ? 22 : 8), 8, 95),
    confidence: route.action === "open-carry" ? 0.78 : route.action === "monitor" ? 0.58 : 0.34,
    capacityUsd: Math.min(50_000, Math.max(0, lab.notionalUsd * 1.4)),
    sourceCount: lab.sources.length,
    status,
    evidence: `${route.spotVenue}/${route.perpVenue}; net APR ${route.expectedNetAprPct.toFixed(2)}%`,
  };
}

function mexicoCandidate(lab?: MexicoCorridorLab): AllocationCandidate {
  const route = lab?.bestRoute;
  if (!lab || !route) return missingAllocationCandidate("mexico", "Mexico BTC/MXN corridor", "Waiting for Bitso and Coinbase depth");
  return {
    id: "mexico",
    label: "Mexico BTC/MXN corridor",
    expectedReturnBps: route.netPnlBps,
    riskBps: route.complete ? 24 : 62,
    confidence: route.complete ? 0.7 : 0.32,
    capacityUsd: Math.min(25_000, Math.max(0, route.startUsd)),
    sourceCount: lab.sources.length,
    status: route.complete && route.netPnlUsd > 0 ? "active" : route.complete ? "watch" : "rejected",
    evidence: `${route.label}; FX edge ${route.netPnlBps.toFixed(2)} bps`,
  };
}

function triangularCandidate(lab?: TriangularLab): AllocationCandidate {
  const route = lab?.bestRoute;
  if (!lab || !route) return missingAllocationCandidate("triangular", "Coinbase triangular cycle", "Waiting for BTC/ETH/USD depth");
  return {
    id: "triangular",
    label: "Coinbase triangular cycle",
    expectedReturnBps: route.netPnlBps,
    riskBps: route.complete ? 28 : 68,
    confidence: route.complete ? 0.64 : 0.3,
    capacityUsd: Math.min(18_000, Math.max(0, lab.startUsd)),
    sourceCount: lab.sources.length,
    status: route.complete && route.netPnlUsd > 0 ? "active" : route.complete ? "watch" : "rejected",
    evidence: `${route.label}; net ${money.format(route.netPnlUsd)}`,
  };
}

function historicalCandidate(replay?: HistoricalReplay): AllocationCandidate {
  if (!replay || replay.strategies.length === 0) {
    return missingAllocationCandidate("historical", "Historical stat-arb replay", "Waiting for Kraken/Coinbase candles");
  }
  const strategy = [...replay.strategies].sort((a, b) => b.summary.riskAdjustedScore - a.summary.riskAdjustedScore)[0];
  const deployedUsd = Math.max(10_000, strategy.config.sizeBtc * 70_000 * Math.max(1, strategy.summary.tradeCount));
  const drawdownRiskBps = (strategy.summary.maxDrawdownUsd / Math.max(10_000, deployedUsd)) * 10_000;
  return {
    id: "historical",
    label: "Historical stat-arb replay",
    expectedReturnBps: (strategy.summary.totalPnlUsd / deployedUsd) * 10_000,
    riskBps: clampNumber(drawdownRiskBps + strategy.config.envelopeUncertaintyBps, 10, 88),
    confidence: clampNumber(0.35 + strategy.summary.winRate * 0.38 + Math.min(0.12, strategy.summary.tradeCount / 250), 0.35, 0.86),
    capacityUsd: 35_000,
    sourceCount: replay.sources.length,
    status: strategy.summary.totalPnlUsd > 0 && strategy.summary.riskAdjustedScore >= 60 ? "active" : "watch",
    evidence: `${strategy.label}; score ${strategy.summary.riskAdjustedScore}/100`,
  };
}

function liquidityCandidate(radar?: LiquidityRadar): AllocationCandidate {
  if (!radar) return missingAllocationCandidate("liquidity", "Global liquidity radar", "Waiting for public REST L2 sweep");
  const bestRoute = radar.routes[0];
  const routeCoverage = radar.summary.routeCount > 0 ? radar.summary.executableRoutes / radar.summary.routeCount : 0;
  return {
    id: "liquidity",
    label: "Global liquidity radar",
    expectedReturnBps: (radar.summary.bestNetProfitUsd / Math.max(1, radar.targetSizeBtc * (bestRoute?.buyVwap || 70_000))) * 10_000,
    riskBps: clampNumber(42 - routeCoverage * 24 + Math.max(0, radar.summary.medianSpreadBps - 8), 10, 76),
    confidence: clampNumber((radar.summary.venuesLoaded / 7) * 0.48 + routeCoverage * 0.32, 0.28, 0.82),
    capacityUsd: Math.min(45_000, Math.max(0, radar.targetSizeBtc * (bestRoute?.buyVwap || 70_000) * 1.5)),
    sourceCount: radar.summary.sourceCount,
    status: radar.summary.executableRoutes > 0 && radar.summary.bestNetProfitUsd > 0 ? "active" : "watch",
    evidence: `${radar.summary.venuesLoaded} venues; ${radar.summary.executableRoutes}/${radar.summary.routeCount} executable`,
  };
}

function missingAllocationCandidate(id: AllocationCandidate["id"], label: string, evidence: string): AllocationCandidate {
  return {
    id,
    label,
    expectedReturnBps: 0,
    riskBps: 0,
    confidence: 0,
    capacityUsd: 0,
    sourceCount: 0,
    status: "missing",
    evidence,
  };
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "amber" | "cyan" | "neutral" }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-2xl font-semibold text-white">{value}</div>
        <Badge tone={tone}>live</Badge>
      </div>
    </div>
  );
}

function BackendEvidenceView({ evidence }: { evidence: BackendEvidenceState }) {
  const manifest = evidence.manifest;
  const health = evidence.health;
  const modules = manifest?.modules ?? [];
  const checks = new Map((health?.checks ?? []).map((check) => [check.id, check]));
  const sourceCount =
    health?.publicSourceCount ??
    new Set(modules.flatMap((module) => module.publicSources.map((source) => source.url))).size;
  const ready = evidence.status === "ready" && Boolean(health?.ok);
  const alertTone = evidence.status === "error" ? "red" : ready ? "green" : "amber";
  const checkedAt = evidence.checkedAt ? new Date(evidence.checkedAt).toLocaleTimeString() : "pending";

  return (
    <div className="space-y-4">
      <Alert tone={alertTone}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <AlertTitle>{ready ? "Full-stack backend evidence online" : "Backend evidence collecting"}</AlertTitle>
            <AlertDescription>
              Next.js Route Handlers act as the serverless backend: public API aggregation, CORS-resilient proxies,
              normalization, fallback policy, and no private exchange keys.
            </AlertDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={alertTone}>{evidence.status}</Badge>
            <Badge tone="neutral">{checkedAt}</Badge>
          </div>
        </div>
      </Alert>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <BackendKpi label="Backend modules" value={health ? String(health.moduleCount) : modules.length ? String(modules.length) : "loading"} tone={ready ? "green" : "amber"} />
        <BackendKpi label="Public sources" value={sourceCount ? String(sourceCount) : "loading"} tone="cyan" />
        <BackendKpi label="Private API keys" value={manifest?.requiresPrivateApiKeys === false ? "0 required" : "verifying"} tone={manifest?.requiresPrivateApiKeys === false ? "green" : "amber"} />
        <BackendKpi label="Health latency" value={evidence.latencyMs === undefined ? "pending" : `${Math.round(evidence.latencyMs)}ms`} tone={evidence.status === "error" ? "red" : "neutral"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Database size={16} className="text-cyan-300" /> Full-Stack Contract
            </CardTitle>
            <CardDescription>What the jury can verify without guessing architecture from source code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ArchitectureProofRow label="Frontend" value="Cockpit, Web Worker execution engine, IndexedDB journal, replay UI." />
            <ArchitectureProofRow label="Backend" value="Next.js Route Handlers under app/api with server-side public fetch, aggregation, and fallback." />
            <ArchitectureProofRow label="Deployment" value="Vercel Hobby-compatible; no card-backed database, no always-on worker, no private keys." />
            <Separator />
            <div className="grid gap-2">
              <EndpointPill endpoint="/api/health" status={health?.ok ? "ok" : evidence.status} />
              <EndpointPill endpoint="/api/backend-manifest" status={manifest ? "ok" : evidence.status} />
              <EndpointPill endpoint="/api/price-consensus" status="manual proof" />
              <EndpointPill endpoint="/api/usdt-basis" status="manual proof" />
              <EndpointPill endpoint="/api/liquidity-radar" status="manual proof" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-300" /> Backend Audit Surface
                </CardTitle>
                <CardDescription>Server-side adapters grouped by role, public sources, and degradation behavior.</CardDescription>
              </div>
              <Badge tone={manifest?.requiresDatabase === false ? "green" : "amber"}>
                {manifest?.requiresDatabase === false ? "no database required" : "verifying"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="modules">
              <TabsList>
                <TabsTrigger value="modules">Modules</TabsTrigger>
                <TabsTrigger value="roles">Roles</TabsTrigger>
                <TabsTrigger value="proof">Proof</TabsTrigger>
              </TabsList>
              <TabsContent value="modules">
                <ScrollArea className="rounded-md border border-zinc-800">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Sources</TableHead>
                        <TableHead>Crosses</TableHead>
                        <TableHead>Health</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-sm text-zinc-500">
                            Backend manifest is loading.
                          </TableCell>
                        </TableRow>
                      ) : (
                        modules.map((module) => (
                          <BackendModuleRow key={module.id} module={module} status={checks.get(module.id)?.status ?? "configured"} />
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="roles">
                <div className="grid gap-2 sm:grid-cols-2">
                  {summarizeBackendRoles(modules).map((item) => (
                    <div key={item.role} className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-zinc-100">{item.role}</div>
                        <Badge tone="cyan">{item.count} modules</Badge>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-zinc-400">{item.sources} public source refs</div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="proof">
                <div className="grid gap-3 lg:grid-cols-3">
                  <ProofCard label="Simulation only" value="No order placement, no custody, no real balances." tone="cyan" />
                  <ProofCard label="No card services" value={manifest?.deploymentTarget ?? "Vercel Hobby"} tone="green" />
                  <ProofCard label="No private keys" value="Every module requiresApiKey=false." tone="green" />
                </div>
                {evidence.error && (
                  <Alert tone="red" className="mt-3">
                    <AlertTitle>Backend evidence error</AlertTitle>
                    <AlertDescription>{evidence.error}</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function BackendKpi({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "amber" | "cyan" | "neutral" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase text-zinc-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
          <Badge tone={tone}>backend</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ArchitectureProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-sm leading-5 text-zinc-200">{value}</div>
    </div>
  );
}

function EndpointPill({ endpoint, status }: { endpoint: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
      <code className="text-xs text-zinc-300">{endpoint}</code>
      <Badge tone={status === "ok" ? "green" : status === "error" ? "red" : "neutral"}>{status}</Badge>
    </div>
  );
}

function BackendModuleRow({ module, status }: { module: BackendModule; status: string }) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-zinc-100">{module.label}</div>
        <code className="mt-1 block text-xs text-zinc-500">{module.endpoint}</code>
      </TableCell>
      <TableCell>
        <Badge tone={backendRoleTone(module.role)}>{module.role}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{module.publicSources.length}</TableCell>
      <TableCell className="max-w-[280px] truncate text-zinc-400">{module.crosses.join(" + ")}</TableCell>
      <TableCell>
        <Badge tone={status === "configured" ? "green" : "amber"}>{status}</Badge>
      </TableCell>
    </TableRow>
  );
}

function ProofCard({ label, value, tone }: { label: string; value: string; tone: "green" | "cyan" | "amber" }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <Badge tone={tone}>{label}</Badge>
      <div className="mt-3 text-sm leading-5 text-zinc-200">{value}</div>
    </div>
  );
}

function summarizeBackendRoles(modules: BackendModule[]) {
  const counts = new Map<BackendModule["role"], { count: number; sources: number }>();
  for (const module of modules) {
    const current = counts.get(module.role) ?? { count: 0, sources: 0 };
    counts.set(module.role, {
      count: current.count + 1,
      sources: current.sources + module.publicSources.length,
    });
  }
  return [...counts.entries()].map(([role, value]) => ({ role, ...value }));
}

function backendRoleTone(role: BackendModule["role"]): "green" | "red" | "amber" | "cyan" | "neutral" {
  if (role === "snapshot-proxy") return "cyan";
  if (role === "risk-oracle") return "amber";
  if (role === "strategy-lab") return "green";
  return "neutral";
}

function ExchangeMatrix({
  books,
  enabled,
  health,
  onToggleExchange,
}: {
  books: OrderBookSnapshot[];
  enabled: ExchangeId[];
  health: FeedHealth[];
  onToggleExchange: (exchangeId: ExchangeId) => void;
}) {
  const [laneFilter, setLaneFilter] = useState<"ALL" | "USD" | "USDT">("ALL");
  const enabledSet = new Set(enabled);
  const bookByExchange = new Map(books.map((book) => [book.exchangeId, book]));
  const adapterByExchange = new Map(exchangeAdapters.map((adapter) => [adapter.exchangeId, adapter]));
  const laneForExchange = (exchangeId: ExchangeId) =>
    bookByExchange.get(exchangeId)?.quoteAsset ?? adapterByExchange.get(exchangeId)?.lane;
  const liveCount = health.filter((item) => enabledSet.has(item.exchangeId) && item.status === "live").length;
  const loadedBooks = enabled.filter((exchangeId) => bookByExchange.has(exchangeId)).length;
  const filteredAdapters = exchangeAdapters.filter((adapter) => laneFilter === "ALL" || adapter.lane === laneFilter);
  const filteredEnabled = enabled.filter((exchangeId) => laneFilter === "ALL" || laneForExchange(exchangeId) === laneFilter);
  const laneCounts = enabled.reduce(
    (counts, exchangeId) => {
      const quote = laneForExchange(exchangeId);
      if (quote === "USD") counts.USD += 1;
      if (quote === "USDT") counts.USDT += 1;
      return counts;
    },
    { USD: 0, USDT: 0 },
  );
  const matrixTone = liveCount >= 2 ? "green" : enabled.length >= 2 ? "amber" : "red";
  const matrixTitle = liveCount >= 2 ? "Same-lane route engine armed" : "Waiting for compatible live books";

  return (
    <div className="flex flex-col gap-4">
      <Alert tone={matrixTone}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <AlertTitle>{matrixTitle}</AlertTitle>
            <AlertDescription>
              {loadedBooks}/{enabled.length} selected books loaded · {liveCount} live feeds · USD {laneCounts.USD} / USDT {laneCounts.USDT}.
              The simulator only compares compatible quote lanes unless a basis haircut explicitly allows it.
            </AlertDescription>
          </div>
          <Badge tone={matrixTone}>{liveCount >= 2 ? "execution ready" : "collecting depth"}</Badge>
        </div>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
        <div>
          <div className="text-xs uppercase text-zinc-500">Quote lane filter</div>
          <div className="mt-1 text-sm text-zinc-400">
            Inspect USD and USDT venues separately so the simulator never hides basis risk.
          </div>
        </div>
        <ToggleGroup
          aria-label="Quote lane filter"
          value={laneFilter}
          onValueChange={(value) => setLaneFilter(value as "ALL" | "USD" | "USDT")}
        >
          <ToggleGroupItem value="ALL">All</ToggleGroupItem>
          <ToggleGroupItem value="USD">USD</ToggleGroupItem>
          <ToggleGroupItem value="USDT">USDT</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <VenueConnectionLab
        adapters={filteredAdapters}
        books={books}
        enabled={enabled}
        health={health}
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {filteredAdapters.map((adapter) => {
          const selected = enabled.includes(adapter.exchangeId);
          const book = bookByExchange.get(adapter.exchangeId);
          const status = health.find((item) => item.exchangeId === adapter.exchangeId);
          return (
            <ExchangeToggleCard
              key={adapter.exchangeId}
              book={book}
              label={adapter.label}
              lane={adapter.lane}
              selected={selected}
              status={status}
              onToggle={() => onToggleExchange(adapter.exchangeId)}
            />
          );
        })}
      </div>

      <ScrollArea className="hidden rounded-md border border-zinc-800 md:block">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Exchange</TableHead>
              <TableHead>Lane</TableHead>
              <TableHead className="text-right">Best bid</TableHead>
              <TableHead className="text-right">Best ask</TableHead>
              <TableHead className="text-right">Spread</TableHead>
              <TableHead className="text-right">Top depth</TableHead>
              <TableHead>Health</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEnabled.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-sm text-zinc-500">
                  No selected venues in the {laneFilter} lane. Toggle an exchange card or switch lanes.
                </TableCell>
              </TableRow>
            ) : (
              filteredEnabled.map((exchangeId) => {
              const book = bookByExchange.get(exchangeId);
              const lane = adapterByExchange.get(exchangeId)?.lane;
              const status = health.find((item) => item.exchangeId === exchangeId);
              return <ExchangeRow key={exchangeId} book={book} exchangeId={exchangeId} lane={lane} status={status} />;
              })
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      <BookmapLite books={filteredEnabled.map((exchangeId) => bookByExchange.get(exchangeId)).filter((book): book is OrderBookSnapshot => Boolean(book))} />
    </div>
  );
}

function VenueConnectionLab({
  adapters,
  books,
  enabled,
  health,
}: {
  adapters: typeof exchangeAdapters;
  books: OrderBookSnapshot[];
  enabled: ExchangeId[];
  health: FeedHealth[];
}) {
  const enabledSet = new Set(enabled);
  const bookByExchange = new Map(books.map((book) => [book.exchangeId, book]));
  const healthByExchange = new Map(health.map((item) => [item.exchangeId, item]));
  const activeAdapters = adapters.filter((adapter) => enabledSet.has(adapter.exchangeId));
  const totalRaw = activeAdapters.reduce((sum, adapter) => sum + (healthByExchange.get(adapter.exchangeId)?.rawMessageCount ?? 0), 0);
  const totalNormalized = activeAdapters.reduce((sum, adapter) => sum + (healthByExchange.get(adapter.exchangeId)?.normalizedMessageCount ?? 0), 0);
  const totalRejected = activeAdapters.reduce((sum, adapter) => sum + (healthByExchange.get(adapter.exchangeId)?.rejectedMessageCount ?? 0), 0);
  const endpointCount = new Set(activeAdapters.map((adapter) => adapter.websocketUrl)).size;

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/70">
      <div className="grid gap-3 border-b border-zinc-800 p-3 md:grid-cols-4">
        <DataCell label="WS venues selected" value={`${activeAdapters.length}/${exchangeAdapters.length}`} />
        <DataCell label="Public endpoints" value={String(endpointCount)} />
        <DataCell label="Raw / normalized" value={`${totalRaw}/${totalNormalized}`} />
        <DataCell label="Rejected payloads" value={String(totalRejected)} />
      </div>
      <Tabs defaultValue="connections">
        <TabsList className="mx-3 mt-3">
          <TabsTrigger value="connections">Connection Lab</TabsTrigger>
          <TabsTrigger value="yield">Source Yield</TabsTrigger>
        </TabsList>
        <TabsContent value="connections" className="p-3">
          <div className="grid gap-3 md:hidden">
            {activeAdapters.map((adapter) => (
              <VenueConnectionCard
                key={adapter.exchangeId}
                adapter={adapter}
                book={bookByExchange.get(adapter.exchangeId)}
                feed={healthByExchange.get(adapter.exchangeId)}
              />
            ))}
          </div>
          <ScrollArea className="hidden rounded border border-zinc-800 md:block">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Venue</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Raw/s</TableHead>
                  <TableHead className="text-right">Deltas</TableHead>
                  <TableHead className="text-right">Rejects</TableHead>
                  <TableHead className="text-right">Reconnects</TableHead>
                  <TableHead>Fallback</TableHead>
                  <TableHead>Transport</TableHead>
                  <TableHead>Payload</TableHead>
                  <TableHead>Last signal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAdapters.map((adapter) => {
                  const feed = healthByExchange.get(adapter.exchangeId);
                  const book = bookByExchange.get(adapter.exchangeId);
                  return (
                    <TableRow key={adapter.exchangeId}>
                      <TableCell>
                        <div className="font-medium text-zinc-100">{adapter.label}</div>
                        <a className="text-xs text-cyan-300 hover:text-cyan-200" href={adapter.docsUrl} target="_blank" rel="noreferrer">
                          docs
                        </a>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-zinc-400">{adapterChannel(adapter)}</code>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{(feed?.messagesPerSecond ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{feed?.normalizedMessageCount ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{feed?.rejectedMessageCount ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{feed?.reconnectCount ?? 0}</TableCell>
                      <TableCell>
                        <Badge tone={feed?.snapshotFallback === "failed" ? "red" : feed?.snapshotFallback === "loaded" ? "green" : "neutral"}>
                          {feed?.snapshotFallback ?? (adapter.restSnapshotUrl ? "ready" : "none")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge tone={feed?.transport === "rest-fallback" ? "cyan" : "neutral"}>
                          {feed?.transport ?? "websocket"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="truncate text-xs text-zinc-400">{feed?.lastPayloadShape ?? "waiting"}</div>
                        {feed?.closeCode ? (
                          <div className="mt-1 text-[11px] text-zinc-500">close {feed.closeCode}{feed.closeReason ? ` · ${feed.closeReason}` : ""}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="truncate text-xs text-zinc-300">{feed?.lastRejectReason ?? feed?.message ?? "not started"}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {book ? `${book.bids.length}/${book.asks.length} L2 levels` : "waiting for book"} · {formatAge(feed?.lastMessageAt)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="yield" className="p-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {activeAdapters.map((adapter) => (
              <div key={adapter.exchangeId} className="rounded border border-zinc-800 bg-zinc-900/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">{adapter.label}</div>
                    <div className="mt-1 text-xs text-zinc-500">{adapter.websocketUrl.replace("wss://", "")}</div>
                  </div>
                  <Badge tone={adapter.lane === "USD" ? "cyan" : "amber"}>{adapter.lane}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(adapter.sourceYield ?? sourceYieldFields(adapter.exchangeId)).map((field) => (
                    <Badge key={field} tone="neutral">{field}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VenueConnectionCard({
  adapter,
  book,
  feed,
}: {
  adapter: (typeof exchangeAdapters)[number];
  book?: OrderBookSnapshot;
  feed?: FeedHealth;
}) {
  const fallbackTone =
    feed?.snapshotFallback === "failed" ? "red" : feed?.snapshotFallback === "loaded" ? "green" : "neutral";
  return (
    <Card className="bg-zinc-900/70">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{adapter.label}</CardTitle>
            <CardDescription className="mt-1 truncate">{adapterChannel(adapter)}</CardDescription>
          </div>
          <Badge tone={healthTone(feed?.status)}>{feed?.status ?? "idle"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <DataCell label="Raw/s" value={(feed?.messagesPerSecond ?? 0).toFixed(2)} />
          <DataCell label="Deltas" value={String(feed?.normalizedMessageCount ?? 0)} />
          <DataCell label="Rejects" value={String(feed?.rejectedMessageCount ?? 0)} />
          <DataCell label="Reconnects" value={String(feed?.reconnectCount ?? 0)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={fallbackTone}>{feed?.snapshotFallback ?? (adapter.restSnapshotUrl ? "fallback ready" : "no fallback")}</Badge>
          <Badge tone={feed?.transport === "rest-fallback" ? "cyan" : "neutral"}>{feed?.transport ?? "websocket"}</Badge>
          <Badge tone={adapter.lane === "USD" ? "cyan" : "amber"}>{adapter.lane}</Badge>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
          <div className="text-xs uppercase text-zinc-500">Payload</div>
          <div className="mt-1 break-words font-mono text-xs leading-5 text-zinc-300">{feed?.lastPayloadShape ?? "waiting"}</div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
          <div className="text-xs uppercase text-zinc-500">Last signal</div>
          <div className="mt-1 text-xs leading-5 text-zinc-300">{feed?.lastRejectReason ?? feed?.message ?? "not started"}</div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {book ? `${book.bids.length}/${book.asks.length} L2 levels` : "waiting for book"} · {formatAge(feed?.lastMessageAt)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BookmapLite({ books }: { books: OrderBookSnapshot[] }) {
  const visibleBooks = books.slice(0, 6);
  if (visibleBooks.length === 0) return <EmptyState text="Bookmap-lite appears after at least one selected venue loads L2 depth." />;
  const maxSize = Math.max(
    0.001,
    ...visibleBooks.flatMap((book) => [...book.bids.slice(0, 8), ...book.asks.slice(0, 8)].map((level) => level.size)),
  );

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Bookmap-lite Depth Heat</div>
          <div className="mt-1 text-xs text-zinc-500">Top 8 bid/ask levels by venue; brighter bars mean more visible BTC liquidity.</div>
        </div>
        <Badge tone="cyan">{visibleBooks.length} venues</Badge>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {visibleBooks.map((book) => (
          <div key={book.exchangeId} className="rounded border border-zinc-800 bg-zinc-900/60 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-zinc-300">{book.exchangeId}</span>
              <span className="text-[11px] text-zinc-500">{book.quoteAsset}</span>
            </div>
            <div className="space-y-1">
              {book.asks.slice(0, 8).reverse().map((level) => (
                <DepthHeatRow key={`ask-${level.price}`} side="ask" level={level} maxSize={maxSize} />
              ))}
              <div className="h-px bg-zinc-700" />
              {book.bids.slice(0, 8).map((level) => (
                <DepthHeatRow key={`bid-${level.price}`} side="bid" level={level} maxSize={maxSize} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepthHeatRow({ side, level, maxSize }: { side: "bid" | "ask"; level: { price: number; size: number }; maxSize: number }) {
  const width = Math.max(4, Math.min(100, (level.size / maxSize) * 100));
  const color = side === "bid" ? "bg-emerald-400/45" : "bg-red-400/45";
  return (
    <div className="relative grid grid-cols-[92px_1fr_70px] items-center gap-2 overflow-hidden rounded px-2 py-1 text-[11px] tabular-nums text-zinc-300">
      <div className={`absolute inset-y-0 ${side === "bid" ? "left-0" : "right-0"} ${color}`} style={{ width: `${width}%` }} />
      <span className="relative z-10">{money.format(level.price)}</span>
      <span className="relative z-10 text-zinc-500">{side.toUpperCase()}</span>
      <span className="relative z-10 text-right">{btc.format(level.size)}</span>
    </div>
  );
}

function ExchangeToggleCard({
  book,
  label,
  lane,
  selected,
  status,
  onToggle,
}: {
  book?: OrderBookSnapshot;
  label: string;
  lane: string;
  selected: boolean;
  status?: FeedHealth;
  onToggle: () => void;
}) {
  const spread = book?.bids[0]?.price && book?.asks[0]?.price ? book.asks[0].price - book.bids[0].price : undefined;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
        selected
          ? "border-emerald-500/50 bg-emerald-500/10"
          : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-700 hover:bg-zinc-900"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-100">{label}</div>
          <div className="mt-1 text-xs uppercase text-zinc-500">{book?.quoteAsset ?? lane}</div>
        </div>
        <Badge tone={selected ? healthTone(status?.status) : "neutral"}>{selected ? status?.status ?? "idle" : "off"}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniMarketStat label="Spread" value={spread === undefined ? "pending" : money.format(spread)} loading={selected && !book} />
        <MiniMarketStat label="Msgs/s" value={status ? `${(status.messagesPerSecond ?? 0).toFixed(2)}` : "idle"} loading={selected && status?.status === "connecting"} />
      </div>
    </button>
  );
}

function MiniMarketStat({ label, value, loading = false }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/80 p-2">
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      {loading ? <Skeleton className="mt-2 h-4 w-16" /> : <div className="mt-1 truncate text-xs font-medium text-zinc-200">{value}</div>}
    </div>
  );
}

function ExchangeRow({
  exchangeId,
  book,
  lane,
  status,
}: {
  exchangeId: string;
  book?: OrderBookSnapshot;
  lane?: string;
  status?: FeedHealth;
}) {
  const bid = book?.bids[0]?.price;
  const ask = book?.asks[0]?.price;
  const spread = bid && ask ? ask - bid : undefined;
  const topDepth = (book?.bids[0]?.size ?? 0) + (book?.asks[0]?.size ?? 0);
  return (
    <TableRow>
      <TableCell className="font-medium capitalize text-zinc-100">{exchangeId}</TableCell>
      <TableCell>{book?.quoteAsset ?? lane ?? "-"}</TableCell>
      <TableCell className="text-right tabular-nums">{bid ? money.format(bid) : <Skeleton className="ml-auto h-4 w-24" />}</TableCell>
      <TableCell className="text-right tabular-nums">{ask ? money.format(ask) : <Skeleton className="ml-auto h-4 w-24" />}</TableCell>
      <TableCell className="text-right tabular-nums">{spread !== undefined ? money.format(spread) : "-"}</TableCell>
      <TableCell className="text-right tabular-nums">{topDepth ? `${btc.format(topDepth)} BTC` : "-"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={healthTone(status?.status)}>{status?.status ?? "idle"}</Badge>
          <span className="text-xs text-zinc-500">{status ? `${Math.round(status.latencyMs)}ms` : ""}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function DecisionView({ decision }: { decision?: OpportunityDecision }) {
  if (!decision) {
    return (
      <Empty>
        <EmptyMedia>
          <Activity size={18} />
        </EmptyMedia>
        <EmptyTitle>No executable route yet</EmptyTitle>
        <EmptyDescription>
          Start live feeds or replay. The engine needs two compatible same-lane books before it can walk depth,
          price costs, and produce a decision receipt.
        </EmptyDescription>
        <EmptyContent>
          <Badge tone="amber">waiting for compatible order books</Badge>
        </EmptyContent>
      </Empty>
    );
  }
  const waterfall = buildPnlWaterfall(decision);
  const depthLens = buildExecutionDepthLens(decision);
  const decisionTone = decision.status === "accepted" ? "green" : "red";
  const reasonTone = decision.status === "accepted" ? "green" : "amber";
  const visibleReasons = decision.rejectionReasons.length > 0 ? decision.rejectionReasons : decision.risk.reasons;
  const netFormula = buildDecisionNetFormula(decision);
  const gates = buildDecisionGateChecklist(decision);
  return (
    <div className="flex flex-col gap-4">
      <Alert tone={decisionTone}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <AlertTitle className="capitalize">{decision.buyExchange} → {decision.sellExchange}</AlertTitle>
            <AlertDescription>
              {decision.quoteAsset} lane · {btc.format(decision.tradeSizeBtc)} BTC · net {money.format(decision.netProfitUsd)} · P(win){" "}
              {(decision.risk.positivePnlProbability * 100).toFixed(1)}%.
            </AlertDescription>
          </div>
          <Badge tone={decisionTone}>{decision.status}</Badge>
        </div>
      </Alert>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="depth">Depth</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DataCell label="Trade size" value={`${btc.format(decision.tradeSizeBtc)} BTC`} />
            <DataCell label="Net P&L" value={money.format(decision.netProfitUsd)} />
            <DataCell label="Buy VWAP" value={money.format(decision.buyFill.vwap)} />
            <DataCell label="Sell VWAP" value={money.format(decision.sellFill.vwap)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <ScoreGauge label="Execution probability" value={decision.risk.positivePnlProbability * 100} suffix="%" />
            <ScoreGauge label="Risk score" value={decision.risk.score} suffix="/100" invert />
          </div>
          <DecisionGateChecklist gates={gates} />
          <FormulaExplainer spec={netFormula} />
        </TabsContent>

        <TabsContent value="costs" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DataCell label="Gross spread" value={money.format(decision.grossProfitUsd)} />
            <DataCell label="Net edge" value={money.format(decision.netProfitUsd)} />
            <DataCell label="Fees" value={money.format(decision.risk.feeCostUsd)} />
            <DataCell label="Withdrawal/rebalance" value={money.format(decision.risk.withdrawalCostUsd)} />
            <DataCell label="Latency cut" value={money.format(decision.risk.latencyPenaltyUsd)} />
            <DataCell label="Risk probability" value={`${(decision.risk.positivePnlProbability * 100).toFixed(1)}%`} />
          </div>
          <PnlWaterfallView steps={waterfall} compact />
        </TabsContent>

        <TabsContent value="depth" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DataCell label="Buy levels" value={String(decision.buyFill.levelsUsed.length)} />
            <DataCell label="Sell levels" value={String(decision.sellFill.levelsUsed.length)} />
            <DataCell label="Buy fill" value={`${btc.format(decision.buyFill.filledBtc)} BTC`} />
            <DataCell label="Sell fill" value={`${btc.format(decision.sellFill.filledBtc)} BTC`} />
          </div>
          <DepthLensView lens={depthLens} compact />
        </TabsContent>

        <TabsContent value="audit" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DataCell label="Decision ID" value={decision.id.slice(0, 12)} />
            <DataCell label="Observed" value={`${Math.max(0, Math.round((Date.now() - decision.observedAt) / 1000))}s ago`} />
            <DataCell label="Quote lane" value={decision.quoteAsset} />
            <DataCell label="Status" value={decision.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleReasons.length > 0 ? (
              visibleReasons.map((reason) => (
                <Badge key={reason} tone={reasonTone}>
                  {reason}
                </Badge>
              ))
            ) : (
              <Badge tone="green">all checks passed</Badge>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoreGauge({
  label,
  value,
  suffix,
  invert = false,
}: {
  label: string;
  value: number;
  suffix: string;
  invert?: boolean;
}) {
  const clamped = clampNumber(value, 0, 100);
  const tone = invert ? 100 - clamped : clamped;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase text-zinc-500">{label}</div>
        <div className="text-sm font-semibold tabular-nums text-zinc-100">
          {clamped.toFixed(1)}
          {suffix}
        </div>
      </div>
      <Progress value={clamped} className={tone >= 70 ? "mt-3" : "mt-3 [&>div]:bg-amber-400"} />
    </div>
  );
}

function DecisionGateChecklist({ gates }: { gates: DecisionGate[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Decision gate checklist">
      {gates.map((gate) => (
        <Card key={gate.id} className="bg-zinc-900/80">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardDescription className="truncate uppercase">{gate.label}</CardDescription>
                <CardTitle className="mt-1 truncate text-base tabular-nums">{gate.value}</CardTitle>
              </div>
              <Badge tone={decisionGateTone(gate.status)}>{gate.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-5 text-zinc-400">{gate.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function decisionGateTone(status: DecisionGate["status"]): "green" | "red" | "amber" {
  if (status === "pass") return "green";
  if (status === "warn") return "amber";
  return "red";
}

function MarketContextView({ context }: { context?: MarketContext }) {
  if (!context) return <EmptyState text="Loading public market context from Binance, mempool.space, and CoinGecko." />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <DataCell label="Realized vol" value={`${context.volatility.realizedVolBpsPerSecond.toFixed(2)} bps/s`} />
        <DataCell label="Binance 24h volume" value={context.binance24h ? compactUsd(context.binance24h.quoteVolumeUsd) : "unavailable"} />
        <DataCell label="BTC 24h move" value={context.binance24h ? `${context.binance24h.priceChangePercent.toFixed(2)}%` : "unavailable"} />
        <DataCell label="Fastest mempool fee" value={`${context.mempoolFees?.fastestFee ?? 0} sat/vB`} />
        <DataCell label="Fear & Greed" value={context.sentiment ? `${context.sentiment.value}/100 ${context.sentiment.label}` : "unavailable"} />
        <DataCell label="Regime" value={marketRegimeLabel(context)} />
      </div>
      {context.coingecko && (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">
          CoinGecko reference: {money.format(context.coingecko.currentPriceUsd)} · 24h range{" "}
          {money.format(context.coingecko.low24h)}-{money.format(context.coingecko.high24h)} · volume{" "}
          {compactUsd(context.coingecko.totalVolumeUsd)}
        </div>
      )}
      {context.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Partial context: {context.errors.length} public source(s) unavailable.
        </div>
      )}
      <div className="text-xs text-zinc-500">
        Sources: Binance/Kraken candles, mempool.space fees, CoinGecko markets, Alternative.me sentiment.
      </div>
    </div>
  );
}

function TradeTapeToxicityView({ tape }: { tape?: TradeTapeToxicity }) {
  if (!tape) return <EmptyState text="Loading recent public trades from Coinbase and Kraken." />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DataCell label="Tape score" value={`${tape.summary.combinedScore.toFixed(0)}/100`} />
        <DataCell label="Trades read" value={String(tape.summary.tradeCount)} />
        <DataCell label="Venues" value={String(tape.summary.venueCount)} />
        <DataCell label="Policy" value={tape.summary.recommendation} />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {tape.venues.map((venue) => (
          <TradeTapeVenueCard key={venue.exchangeId} venue={venue} />
        ))}
      </div>
      {tape.venues.length === 0 && (
        <EmptyState text="No recent public trades were available from the tape sources." />
      )}
      {tape.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Trade tape degraded gracefully: {tape.errors.length} source issue(s).
        </div>
      )}
      <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
        Toxicity combines signed aggressor volume, short-window price drift, trade pace, and average trade
        size. A toxic tape means simulated execution should halt or cap size even when the book spread looks attractive.
      </div>
    </div>
  );
}

function TradeTapeVenueCard({ venue }: { venue: TradeTapeVenueSummary }) {
  const buyShare = Math.max(0, Math.min(100, ((venue.imbalance + 1) / 2) * 100));
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold capitalize text-zinc-100">{venue.exchangeId}</div>
          <div className="mt-1 text-xs text-zinc-500">{venue.symbol} · {venue.tradeCount} recent trades</div>
        </div>
        <Badge tone={venue.state === "toxic" ? "red" : venue.state === "watch" ? "amber" : "green"}>
          {venue.state}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <DataCell label="Score" value={`${venue.toxicityScore.toFixed(0)}/100`} />
        <DataCell label="Drift" value={`${venue.priceDriftBps.toFixed(2)} bps`} />
        <DataCell label="Pace" value={`${venue.tradesPerMinute.toFixed(1)}/min`} />
        <DataCell label="Avg size" value={`${btc.format(venue.averageTradeBtc)} BTC`} />
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Sell pressure</span>
          <span>Buy pressure</span>
        </div>
        <div className="h-3 overflow-hidden rounded bg-red-400">
          <div className="h-3 bg-emerald-400" style={{ width: `${buyShare}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
          <span>{btc.format(venue.sellAggressorBtc)} BTC sell</span>
          <span className="text-center">signed {btc.format(venue.signedVolumeBtc)} BTC</span>
          <span className="text-right">{btc.format(venue.buyAggressorBtc)} BTC buy</span>
        </div>
      </div>
      <div className="mt-3 rounded border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-300">
        {venue.explanation}. Policy: {venue.recommendation}.
      </div>
    </div>
  );
}

function HawkesFlowShockView({
  oracle,
  compact = false,
}: {
  oracle: HawkesFlowShockOracle;
  compact?: boolean;
}) {
  const tone =
    oracle.summary.policy === "allow"
      ? "green"
      : oracle.summary.policy === "halt-shock"
        ? "red"
        : oracle.summary.policy === "cap-size"
          ? "amber"
          : "neutral";

  if (oracle.venues.length === 0) {
    return <EmptyState text="Loading public trade tape before estimating self-exciting flow shocks." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Shock policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{oracle.summary.policy}</div>
          </div>
          <Badge tone={tone}>{(oracle.summary.branchingRatio * 100).toFixed(0)}% branch</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Aftershock" value={`${(oracle.summary.aftershockProbability * 100).toFixed(1)}%`} />
          <DataCell label="Expected shock" value={`${btc.format(oracle.summary.expectedShockBtc)} BTC`} />
          <DataCell label="Shock half-life" value={`${oracle.summary.shockHalfLifeSeconds.toFixed(2)}s`} />
          <DataCell label="Top-depth coverage" value={`${oracle.summary.topDepthCoveragePct.toFixed(1)}%`} />
        </div>
        <FormulaExplainer
          spec={{
            modelId: "hawkes-flow",
            title: "Self-exciting trade-flow shock",
            equation: oracle.equation,
            plainExplanation:
              "Measures whether recent aggressor trades are likely to trigger another burst that consumes visible liquidity before simulated execution.",
            variables: [
              { symbol: "branching_ratio", label: "branching", value: `${(oracle.summary.branchingRatio * 100).toFixed(1)}%` },
              { symbol: "aftershock_probability", label: "aftershock", value: `${(oracle.summary.aftershockProbability * 100).toFixed(1)}%` },
              { symbol: "expected_shock_btc", label: "expected shock", value: `${btc.format(oracle.summary.expectedShockBtc)} BTC` },
            ],
          }}
        />
        {!compact && (
          <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            Estimates whether recent aggressor trades are self-exciting. A high branching ratio means one burst of
            public flow is likely to trigger another burst that can consume visible liquidity before simulated execution.
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {oracle.venues.map((venue) => (
            <div key={venue.exchangeId} className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold capitalize text-zinc-100">{venue.exchangeId}</div>
                  <div className="mt-1 text-xs text-zinc-500">{venue.evidence}</div>
                </div>
                <Badge tone={hawkesTone(venue.state)}>{venue.state}</Badge>
              </div>
              <div className="mt-3 h-2 rounded bg-zinc-800">
                <div className={`h-2 rounded ${hawkesBarClass(venue.state)}`} style={{ width: `${Math.max(3, venue.branchingRatio * 100)}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <DataCell label="Branching" value={`${(venue.branchingRatio * 100).toFixed(1)}%`} />
                <DataCell label="Aftershock" value={`${(venue.aftershockProbability * 100).toFixed(1)}%`} />
                <DataCell label="Baseline λ" value={`${venue.baselineIntensityPerSecond.toFixed(3)}/s`} />
                <DataCell label="Excited λ" value={`${venue.excitedIntensityPerSecond.toFixed(3)}/s`} />
                <DataCell label="Shock size" value={`${btc.format(venue.expectedShockBtc)} BTC`} />
                <DataCell label="Pressure" value={venue.signedPressure} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {oracle.reasons.slice(0, compact ? 4 : oracle.reasons.length).map((reason) => (
            <Badge key={reason} tone={reason.includes("self-exciting") ? "red" : reason.includes("requires") ? "amber" : "green"}>
              {reason}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function hawkesTone(state: HawkesVenueState): "green" | "amber" | "red" {
  if (state === "benign") return "green";
  if (state === "active") return "amber";
  return "red";
}

function hawkesBarClass(state: HawkesVenueState): string {
  if (state === "benign") return "bg-emerald-400";
  if (state === "active") return "bg-amber-400";
  return "bg-red-400";
}

function LatencyAlphaRaceView({ race, compact = false }: { race: LatencyAlphaRace; compact?: boolean }) {
  const tone =
    race.summary.policy === "cross-now"
      ? "green"
      : race.summary.policy === "cap-size"
        ? "amber"
        : race.summary.policy === "reject-race-lost"
          ? "red"
          : "neutral";
  const maxPnl = Math.max(1, ...race.curve.map((point) => Math.max(0, point.expectedPnlUsd)));

  if (race.curve.length === 0) {
    return <EmptyState text="Generate a live or replay opportunity to simulate the latency alpha race." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Race policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{race.summary.policy}</div>
          </div>
          <Badge tone={tone}>{race.summary.raceScore}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Survival" value={`${(race.summary.survivalProbability * 100).toFixed(1)}%`} />
          <DataCell label="Expected capture" value={money.format(race.summary.expectedCaptureUsd)} />
          <DataCell label="Our p95 latency" value={`${race.summary.ourRaceLatencyMs.toFixed(0)}ms`} />
          <DataCell label="Competitor ETA" value={`${race.summary.competitorArrivalMs.toFixed(0)}ms`} />
          <DataCell label="Edge half-life" value={`${race.summary.edgeHalfLifeMs.toFixed(0)}ms`} />
          <DataCell label="Adverse flow" value={`${race.summary.aggressiveFlowBtcPerSecond.toFixed(4)} BTC/s`} />
        </div>
        <FormulaExplainer
          spec={{
            modelId: "latency-alpha",
            title: "Latency survival and edge capture",
            equation: race.equation,
            plainExplanation:
              "Checks whether the apparent edge survives long enough for this browser-first engine before faster participants or public flow consume the same liquidity.",
            variables: [
              { symbol: "survival", label: "survival probability", value: `${(race.summary.survivalProbability * 100).toFixed(1)}%` },
              { symbol: "expected_capture", label: "expected capture", value: money.format(race.summary.expectedCaptureUsd) },
              { symbol: "edge_half_life", label: "edge half-life", value: `${race.summary.edgeHalfLifeMs.toFixed(0)}ms` },
            ],
          }}
        />
        {!compact && (
          <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            Simulates whether the apparent edge survives long enough for this browser-first engine to capture it
            before faster bots or aggressive public trade flow consume the same top-of-book liquidity.
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">{race.route}</div>
              <div className="text-xs text-zinc-500">survival curve by simulated reaction latency</div>
            </div>
            <Badge tone={race.summary.tailRiskUsd > 20 ? "amber" : "green"}>
              tail risk {money.format(race.summary.tailRiskUsd)}
            </Badge>
          </div>
          <div className="space-y-2">
            {race.curve.map((point) => {
              const pnlTone = point.expectedPnlUsd >= 0 ? "bg-emerald-400" : "bg-red-400";
              return (
                <div key={point.latencyMs} className="grid grid-cols-[58px_1fr_72px] items-center gap-3 text-xs">
                  <span className="text-zinc-400">{point.latencyMs}ms</span>
                  <div className="relative h-5 rounded bg-zinc-800">
                    <div
                      className={`absolute left-0 top-1 h-3 rounded ${pnlTone}`}
                      style={{ width: `${Math.max(3, Math.min(100, (Math.max(0, point.expectedPnlUsd) / maxPnl) * 100))}%` }}
                    />
                    <div
                      className="absolute top-0 h-5 w-0.5 bg-white/80"
                      style={{ left: `${Math.max(2, Math.min(98, point.survivalProbability * 100))}%` }}
                    />
                  </div>
                  <span className="text-right text-zinc-300">{money.format(point.expectedPnlUsd)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-500">
            <span>bar = expected capture</span>
            <span className="text-center">marker = survival</span>
            <span className="text-right">liquidity decay included</span>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {race.factors.slice(0, compact ? 4 : race.factors.length).map((factor) => (
            <div key={factor.label} className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs uppercase text-zinc-500">{factor.label}</div>
                <div className="text-sm font-semibold text-zinc-100">
                  {factor.unit === "USD" ? money.format(factor.value) : factor.unit === "probability" ? `${(factor.value * 100).toFixed(1)}%` : `${factor.value} ${factor.unit}`}
                </div>
              </div>
              <div className="mt-2 text-xs leading-5 text-zinc-400">{factor.interpretation}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {race.reasons.map((reason) => (
            <Badge key={reason} tone={reason.includes("negative") || reason.includes("disadvantage") || reason.includes("consume") ? "amber" : "green"}>
              {reason}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function OptimalStoppingFrontierView({
  frontier,
  compact = false,
}: {
  frontier: OptimalStoppingFrontier;
  compact?: boolean;
}) {
  const tone =
    frontier.summary.policy === "execute-now"
      ? "green"
      : frontier.summary.policy === "wait-short" || frontier.summary.policy === "wait-for-confirmation"
        ? "cyan"
        : frontier.summary.policy === "cap-size"
          ? "amber"
          : frontier.summary.policy === "reject"
            ? "red"
            : "neutral";

  if (frontier.frontier.length === 0) {
    return <EmptyState text="Generate an accepted route to solve execute-now versus wait timing." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Stopping policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{frontier.summary.policy}</div>
          </div>
          <Badge tone={tone}>{frontier.summary.stoppingScore}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Best horizon" value={`${frontier.summary.bestHorizonMs}ms`} />
          <DataCell label="Best EV" value={money.format(frontier.summary.bestExpectedValueUsd)} />
          <DataCell label="Immediate EV" value={money.format(frontier.summary.immediateValueUsd)} />
          <DataCell label="Option value" value={money.format(frontier.summary.optionValueUsd)} />
          <DataCell label="Rec. size" value={`${btc.format(frontier.summary.recommendedSizeBtc)} BTC`} />
          <DataCell label="Horizon count" value={String(frontier.frontier.length)} />
        </div>
        <div className="mt-4">
          <FormulaExplainer
            spec={{
              title: "Optimal stopping equation",
              modelId: "optimal-stopping-frontier",
              equation: frontier.equation,
              plainExplanation: "Compares crossing immediately against waiting for short horizons after edge decay, volatility cost, conformal downside, and historical opportunity clustering.",
            }}
          />
        </div>
        {!compact && (
          <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            This treats execution timing as an optimal-stopping problem: crossing now is compared against short waits
            after edge decay, volatility cost, conformal downside, and historical opportunity clustering are priced.
          </div>
        )}
      </div>
      <div className="space-y-4">
        <StoppingFrontierChart points={frontier.frontier} bestHorizonMs={frontier.summary.bestHorizonMs} />
        <div className="grid gap-2 md:grid-cols-2">
          {frontier.frontier.slice(0, compact ? 4 : frontier.frontier.length).map((point) => (
            <StoppingFrontierPointCard key={point.horizonMs} point={point} selected={point.horizonMs === frontier.summary.bestHorizonMs} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {frontier.reasons.map((reason) => (
            <Badge key={reason} tone={tone}>
              {reason}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function StoppingFrontierChart({
  points,
  bestHorizonMs,
}: {
  points: StoppingFrontierPoint[];
  bestHorizonMs: number;
}) {
  const minEv = Math.min(0, ...points.map((point) => point.expectedValueUsd));
  const maxEv = Math.max(1, ...points.map((point) => point.expectedValueUsd));
  const range = Math.max(1, maxEv - minEv);
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Wait frontier</div>
          <div className="text-xs text-zinc-500">bars = expected value after timing costs</div>
        </div>
        <Badge tone="cyan">best {bestHorizonMs}ms</Badge>
      </div>
      <div className="flex h-36 items-end gap-2 border-b border-zinc-800 pb-2">
        {points.map((point) => {
          const height = Math.max(4, ((point.expectedValueUsd - minEv) / range) * 96);
          const selected = point.horizonMs === bestHorizonMs;
          return (
            <div key={point.horizonMs} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${selected ? "bg-cyan-300" : point.expectedValueUsd >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
                style={{ height: `${height}%` }}
                title={`${point.horizonMs}ms EV ${money.format(point.expectedValueUsd)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid gap-2 text-xs text-zinc-500" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point) => (
          <span key={point.horizonMs} className="text-center">
            {point.horizonMs}ms
          </span>
        ))}
      </div>
    </div>
  );
}

function StoppingFrontierPointCard({ point, selected }: { point: StoppingFrontierPoint; selected: boolean }) {
  return (
    <div className={`rounded border p-3 ${selected ? "border-cyan-500/60 bg-cyan-500/10" : "border-zinc-800 bg-zinc-900"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-100">{point.horizonMs}ms</div>
        <Badge tone={point.expectedValueUsd >= 0 ? "green" : "red"}>{money.format(point.expectedValueUsd)}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DataCell label="Survival" value={`${(point.survivalProbability * 100).toFixed(1)}%`} />
        <DataCell label="Edge" value={money.format(point.decayedEdgeUsd)} />
        <DataCell label="Option" value={money.format(point.optionValueUsd)} />
        <DataCell label="Vol cost" value={money.format(point.volatilityCostUsd)} />
        <DataCell label="Conformal" value={money.format(point.conformalPenaltyUsd)} />
      </div>
    </div>
  );
}

function QueuePositionOracleView({ oracle, compact = false }: { oracle: QueuePositionOracle; compact?: boolean }) {
  const tone =
    oracle.summary.recommendation === "post-both-legs"
      ? "green"
      : oracle.summary.recommendation === "cross-now"
        ? "amber"
        : "cyan";
  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Maker/taker action</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{oracle.summary.recommendation}</div>
          </div>
          <Badge tone={tone}>{(oracle.summary.combinedFillProbability * 100).toFixed(1)}% fill</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Taker net" value={money.format(oracle.summary.takerNetUsd)} />
          <DataCell label="Maker EV" value={money.format(oracle.summary.expectedMakerNetUsd)} />
          <DataCell label="Improvement" value={money.format(oracle.summary.expectedImprovementUsd)} />
          <DataCell label="Toxic penalty" value={money.format(oracle.summary.toxicFlowPenaltyUsd)} />
        </div>
        <FormulaExplainer
          spec={{
            modelId: "queue-position",
            title: "Maker fill probability and expected value",
            equation: oracle.equation,
            plainExplanation:
              "Estimates whether simulated post-only maker orders can fill before the edge decays. Queue ahead comes from live L2 top level; fill rate comes from public aggressor trade flow.",
            variables: [
              { symbol: "fill_probability", label: "combined fill", value: `${(oracle.summary.combinedFillProbability * 100).toFixed(1)}%` },
              { symbol: "maker_ev", label: "maker EV", value: money.format(oracle.summary.expectedMakerNetUsd) },
              { symbol: "adverse_selection", label: "toxic penalty", value: money.format(oracle.summary.toxicFlowPenaltyUsd) },
              { symbol: "missed_edge", label: "taker net", value: money.format(oracle.summary.takerNetUsd) },
            ],
          }}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <QueueLegCard leg={oracle.buyLeg} compact={compact} />
        <QueueLegCard leg={oracle.sellLeg} compact={compact} />
      </div>
    </div>
  );
}

function QueueLegCard({ leg, compact = false }: { leg: QueueLegEstimate; compact?: boolean }) {
  const tone = leg.recommendation === "post-maker" ? "green" : "amber";
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold capitalize text-zinc-100">
            {leg.side} on {leg.exchangeId}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            maker {money.format(leg.makerPrice)} vs taker {money.format(leg.takerPrice)}
          </div>
        </div>
        <Badge tone={tone}>{leg.recommendation}</Badge>
      </div>
      <div className="mt-3 h-3 rounded bg-zinc-800">
        <div
          className={leg.recommendation === "post-maker" ? "h-3 rounded bg-emerald-400" : "h-3 rounded bg-amber-400"}
          style={{ width: `${Math.max(3, Math.min(100, leg.fillProbability * 100))}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DataCell label="Fill prob" value={`${(leg.fillProbability * 100).toFixed(1)}%`} />
        <DataCell label="Expected fill" value={`${btc.format(leg.expectedFillBtc)} BTC`} />
        <DataCell label="Queue ahead" value={`${btc.format(leg.queueAheadBtc)} BTC`} />
        <DataCell label="Aggressor flow" value={`${btc.format(leg.aggressorFlowBtcPerSecond)} BTC/s`} />
        {!compact && <DataCell label="Spread capture" value={money.format(leg.spreadCaptureUsd)} />}
        {!compact && <DataCell label="Fee savings" value={money.format(leg.feeSavingsUsd)} />}
        <DataCell label="Adverse selection" value={money.format(leg.adverseSelectionUsd)} />
        <DataCell label="Leg EV" value={money.format(leg.expectedValueUsd)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {leg.reasons.slice(0, compact ? 2 : 4).map((reason) => (
          <Badge key={reason} tone={reason.includes("low") || reason.includes("toxic") || reason.includes("dominates") ? "red" : "green"}>
            {reason}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function LiquidityMirageDetectorView({
  detector,
  compact = false,
}: {
  detector: LiquidityMirageDetector;
  compact?: boolean;
}) {
  const tone =
    detector.summary.policy === "allow"
      ? "green"
      : detector.summary.policy === "halt-mirage"
        ? "red"
        : detector.summary.policy === "cap-size"
          ? "amber"
          : "neutral";
  const visibleFactors = compact ? detector.riskFactors.slice(0, 4) : detector.riskFactors;

  if (detector.riskFactors.length === 0) {
    return <EmptyState text="Generate a live or replay route to test whether the apparent spread is a liquidity mirage." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Mirage policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{detector.summary.policy}</div>
          </div>
          <Badge tone={tone}>{detector.summary.mirageScore}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Retained edge" value={`${detector.summary.executableEdgeRetainedPct.toFixed(1)}%`} />
          <DataCell label="Depth convexity" value={`${detector.summary.depthConvexityBps.toFixed(2)} bps`} />
          <DataCell label="Top-book edge" value={`${detector.summary.topOfBookEdgeBps.toFixed(2)} bps`} />
          <DataCell label="VWAP edge" value={`${detector.summary.vwapEdgeBps.toFixed(2)} bps`} />
          <DataCell label="Top concentration" value={`${detector.summary.concentrationPct.toFixed(1)}%`} />
          <DataCell label="Router confirm" value={`${detector.summary.smartRouterConfirmation}/100`} />
        </div>
        <FormulaExplainer
          spec={{
            modelId: "liquidity-mirage",
            title: "Executable edge retention",
            equation: detector.equation,
            plainExplanation:
              "Separates real executable edge from top-of-book illusions by checking how much spread survives VWAP depth walk, fill completeness, depth cliffs, and concentration.",
            variables: [
              { symbol: "retained_edge", label: "retained edge", value: `${detector.summary.executableEdgeRetainedPct.toFixed(1)}%` },
              { symbol: "top_book_edge", label: "top-book edge", value: `${detector.summary.topOfBookEdgeBps.toFixed(2)} bps` },
              { symbol: "vwap_edge", label: "VWAP edge", value: `${detector.summary.vwapEdgeBps.toFixed(2)} bps` },
            ],
          }}
        />
        {!compact && (
          <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            Distinguishes real executable edge from top-of-book illusions by measuring how much spread survives
            after VWAP depth walk, fill completeness, depth cliffs, top-level concentration, and broad smart-router confirmation.
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <LiquidityMirageSideCard profile={detector.buy} />
          <LiquidityMirageSideCard profile={detector.sell} />
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-zinc-100">Mirage risk factors</div>
            <Badge tone={tone}>{detector.summary.policy}</Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {visibleFactors.map((factor) => (
              <div key={factor.id} className="rounded border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">{factor.label}</div>
                    <div className="mt-1 text-xs text-zinc-500">{factor.explanation}</div>
                  </div>
                  <Badge tone={mirageTone(factor.state)}>{factor.state}</Badge>
                </div>
                <div className="mt-3 h-2 rounded bg-zinc-800">
                  <div className={`h-2 rounded ${mirageBarClass(factor.state)}`} style={{ width: `${Math.max(3, Math.min(100, factor.value))}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>{factor.value.toFixed(factor.unit === "score" ? 0 : 1)} {factor.unit}</span>
                  <span>threshold {factor.threshold}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {detector.reasons.slice(0, compact ? 4 : detector.reasons.length).map((reason) => (
            <Badge key={reason} tone={reason.includes("mirage") || reason.includes("cannot") ? "red" : reason.includes("requires") ? "amber" : "green"}>
              {reason}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiquidityMirageSideCard({ profile }: { profile: LiquidityMirageDetector["buy"] }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold capitalize text-zinc-100">
            {profile.side} on {profile.exchange}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            top {money.format(profile.topPrice)} · vwap {money.format(profile.vwap)}
          </div>
        </div>
        <Badge tone={profile.complete ? "green" : "red"}>{profile.complete ? "complete" : "partial"}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DataCell label="Filled" value={`${btc.format(profile.filledBtc)} BTC`} />
        <DataCell label="Top size" value={`${btc.format(profile.topLevelBtc)} BTC`} />
        <DataCell label="Levels" value={String(profile.levelsUsed)} />
        <DataCell label="Slippage" value={`${profile.slippageBps.toFixed(2)} bps`} />
        <DataCell label="Concentration" value={`${profile.concentrationPct.toFixed(1)}%`} />
        <DataCell label="Cliff" value={`${profile.cliffBps.toFixed(2)} bps`} />
      </div>
    </div>
  );
}

function mirageTone(state: LiquidityMirageFactorState): "green" | "amber" | "red" {
  if (state === "pass") return "green";
  if (state === "watch") return "amber";
  return "red";
}

function mirageBarClass(state: LiquidityMirageFactorState): string {
  if (state === "pass") return "bg-emerald-400";
  if (state === "watch") return "bg-amber-400";
  return "bg-red-400";
}

function LeadLagOracleView({ oracle, compact = false }: { oracle?: LeadLagOracle; compact?: boolean }) {
  if (!oracle) return <EmptyState text="Loading public recent trades from Coinbase, Kraken, Bitstamp, Gemini, Bitfinex, and Binance." />;
  const policyTone =
    oracle.summary.policy === "follow-leader"
      ? "green"
      : oracle.summary.policy === "cap-size"
        ? "amber"
        : oracle.summary.policy === "halt"
          ? "red"
          : "neutral";
  const visibleVenues = compact ? oracle.venues.slice(0, 4) : oracle.venues;
  const visiblePairs = compact ? oracle.pairs.slice(0, 4) : oracle.pairs.slice(0, 8);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <DataCell label="Policy" value={oracle.summary.policy} />
        <DataCell label="Leader" value={oracle.summary.leaderVenue ?? "unknown"} />
        <DataCell label="Leader score" value={`${oracle.summary.leaderScore.toFixed(0)}/100`} />
        <DataCell label="Predicted drift" value={`${oracle.summary.predictedDriftBps.toFixed(2)} bps`} />
        <DataCell label="Divergence" value={`${oracle.summary.divergenceBps.toFixed(2)} bps`} />
        <DataCell label="Haircut" value={`${oracle.summary.executionHaircutBps.toFixed(2)} bps`} />
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.34fr_0.66fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase text-zinc-500">Microstructure action</div>
              <div className="mt-1 text-3xl font-semibold uppercase text-white">{oracle.summary.policy}</div>
            </div>
            <Badge tone={policyTone}>{oracle.summary.confidence}</Badge>
          </div>
          <div className="mt-4">
            <FormulaExplainer
              spec={{
                title: "Lead-lag score equation",
                modelId: "lead-lag-oracle",
                equation: oracle.equation,
                plainExplanation: "Scores whether one public venue leads another after lagged correlation, divergence, freshness, and execution haircut are priced.",
              }}
            />
          </div>
          <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            Lead-lag checks whether one venue is moving first and another is catching up. A positive leader signal
            can support simulated execution; divergence or stale trade flow becomes an execution haircut.
          </div>
          {oracle.errors.length > 0 && (
            <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              Lead-lag oracle degraded gracefully: {oracle.errors.length} source issue(s).
            </div>
          )}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs uppercase text-zinc-500">Venue leadership</div>
            {visibleVenues.map((venue) => (
              <LeadLagVenueRow key={venue.venue} venue={venue} />
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase text-zinc-500">Lagged correlation routes</div>
            {visiblePairs.length > 0 ? (
              visiblePairs.map((pair) => <LeadLagPairRow key={`${pair.leader}-${pair.follower}-${pair.lagBuckets}`} pair={pair} />)
            ) : (
              <EmptyState text="Not enough overlapping trade buckets to infer a leader/follower pair." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadLagVenueRow({ venue }: { venue: LeadLagVenueSignal }) {
  const tone =
    venue.state === "leader" ? "green" : venue.state === "follower" ? "cyan" : venue.state === "stale" ? "red" : "neutral";
  const width = Math.max(3, Math.min(100, venue.leadershipScore));
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{venue.label}</div>
          <div className="mt-1 text-xs text-zinc-500">{venue.explanation}</div>
        </div>
        <Badge tone={tone}>{venue.state}</Badge>
      </div>
      <div className="mt-3 h-3 rounded bg-zinc-800">
        <div className="h-3 rounded bg-emerald-400" style={{ width: `${width}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DataCell label="Lead" value={`${venue.leadershipScore.toFixed(0)}/100`} />
        <DataCell label="Follow" value={`${venue.followerScore.toFixed(0)}/100`} />
        <DataCell label="Trades" value={String(venue.tradeCount)} />
        <DataCell label="Vol" value={`${venue.volatilityBps.toFixed(2)} bps`} />
      </div>
    </div>
  );
}

function LeadLagPairRow({ pair }: { pair: LeadLagPair }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold capitalize text-zinc-100">
            {pair.leader} leads {pair.follower}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            lag {pair.lagBuckets} bucket(s) · {pair.samples} aligned samples
          </div>
        </div>
        <Badge tone={pair.confidence >= 0.7 ? "green" : pair.confidence >= 0.45 ? "amber" : "neutral"}>
          corr {pair.correlation.toFixed(2)}
        </Badge>
      </div>
      <div className="mt-3 h-3 rounded bg-zinc-800">
        <div className="h-3 rounded bg-cyan-300" style={{ width: `${Math.max(3, Math.min(100, pair.confidence * 100))}%` }} />
      </div>
    </div>
  );
}

function DerivativesPressureOracleView({ oracle }: { oracle?: DerivativesPressureOracle }) {
  if (!oracle) return <EmptyState text="Loading public perpetual funding and premium from OKX, Deribit, and BitMEX." />;
  const maxMagnitude = Math.max(
    1,
    ...oracle.venues.map((venue) => Math.max(Math.abs(venue.premiumBps), Math.abs(venue.fundingBps8h))),
  );
  const tone =
    oracle.summary.riskState === "normal"
      ? "green"
      : oracle.summary.riskState === "caution"
        ? "amber"
        : "red";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <DataCell label="Funding median" value={`${oracle.summary.medianFundingBps8h.toFixed(2)} bps/8h`} />
        <DataCell label="Perp premium" value={`${oracle.summary.medianPremiumBps.toFixed(2)} bps`} />
        <DataCell label="Spot haircut" value={`${oracle.summary.spotExecutionHaircutBps.toFixed(2)} bps`} />
        <DataCell label="Direction" value={oracle.summary.direction} />
        <DataCell label="Open interest" value={compactUsd(oracle.summary.totalOpenInterestUsd)} />
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.42fr_0.58fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase text-zinc-500">Derivative pressure policy</div>
            <Badge tone={tone}>{oracle.summary.riskState}</Badge>
          </div>
          <div className="space-y-3 text-sm text-zinc-300">
            <div>{oracle.explanation}</div>
            <div>
              disagreement {oracle.summary.disagreementBps.toFixed(2)} bps · crowded {oracle.summary.crowdedCount} ·
              dislocated {oracle.summary.dislocatedCount} · stale {oracle.summary.staleCount}
            </div>
          </div>
          <div className="mt-4 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            Spot arbitrage can fail when perpetual markets are crowded or dislocated. This panel makes that external
            pressure visible and turns it into an execution haircut before a simulated route is trusted.
          </div>
        </div>
        <div className="space-y-2">
          {oracle.venues.map((venue) => (
            <DerivativesPressureVenueRow key={`${venue.venue}-${venue.instrument}`} venue={venue} maxMagnitude={maxMagnitude} />
          ))}
        </div>
      </div>
      {oracle.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Derivatives pressure degraded gracefully: {oracle.errors.length} source issue(s).
        </div>
      )}
    </div>
  );
}

function DerivativesPressureVenueRow({
  venue,
  maxMagnitude,
}: {
  venue: DerivativesVenuePressureScore;
  maxMagnitude: number;
}) {
  const premiumWidth = Math.max(4, Math.min(100, (Math.abs(venue.premiumBps) / maxMagnitude) * 100));
  const fundingWidth = Math.max(4, Math.min(100, (Math.abs(venue.fundingBps8h) / maxMagnitude) * 100));
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{venue.label}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {venue.instrument} · annualized funding {venue.annualizedFundingPct.toFixed(2)}% · OI{" "}
            {compactUsd(venue.openInterestUsd ?? 0)}
          </div>
        </div>
        <Badge tone={venue.state === "normal" ? "green" : venue.state === "crowded" ? "amber" : "red"}>
          {venue.state}
        </Badge>
      </div>
      <div className="mt-3 space-y-2">
        <PressureBar label="premium" value={venue.premiumBps} width={premiumWidth} />
        <PressureBar label="funding" value={venue.fundingBps8h} width={fundingWidth} />
      </div>
      <div className="mt-2 text-right text-xs text-zinc-500">{Math.round(venue.ageMs / 1000)}s old</div>
    </div>
  );
}

function PressureBar({ label, value, width }: { label: string; value: number; width: number }) {
  return (
    <div className="grid grid-cols-[70px_1fr_82px] items-center gap-2">
      <span className="text-xs uppercase text-zinc-500">{label}</span>
      <div className="grid grid-cols-[1fr_1fr] gap-1">
        <div className="h-3 rounded bg-zinc-800">
          {value < 0 && <div className="ml-auto h-3 rounded bg-red-400" style={{ width: `${width}%` }} />}
        </div>
        <div className="h-3 rounded bg-zinc-800">
          {value >= 0 && <div className="h-3 rounded bg-emerald-400" style={{ width: `${width}%` }} />}
        </div>
      </div>
      <span className={value >= 0 ? "text-right text-xs text-emerald-200" : "text-right text-xs text-red-200"}>
        {value >= 0 ? "+" : ""}{value.toFixed(2)} bps
      </span>
    </div>
  );
}

function CashCarryLabView({ lab, compact = false }: { lab?: CashCarryLab; compact?: boolean }) {
  if (!lab) return <EmptyState text="Loading public spot/perp basis from Coinbase, Kraken, Binance, Bitstamp, OKX, Deribit, and BitMEX." />;
  const best = lab.routes[0];
  const tone =
    lab.summary.recommendedAction === "open-carry"
      ? "green"
      : lab.summary.recommendedAction === "monitor"
        ? "amber"
        : lab.summary.recommendedAction === "halt"
          ? "red"
          : "neutral";
  const visibleRoutes = compact ? lab.routes.slice(0, 3) : lab.routes.slice(0, 6);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <DataCell label="Best net" value={money.format(lab.summary.bestNetUsd)} />
        <DataCell label="Best APR" value={`${lab.summary.bestAprPct.toFixed(2)}%`} />
        <DataCell label="Routes" value={`${lab.summary.executableRoutes}/${lab.routes.length}`} />
        <DataCell label="Max basis" value={`${lab.summary.maxBasisBps.toFixed(1)} bps`} />
        <DataCell label="Horizon" value={`${lab.holdingDays}d / ${compactUsd(lab.notionalUsd)}`} />
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.38fr_0.62fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase text-zinc-500">Basis trade policy</div>
            <Badge tone={tone}>{lab.summary.recommendedAction}</Badge>
          </div>
          <div className="space-y-3 text-sm text-zinc-300">
            <div>{lab.explanation}</div>
            {best && (
              <div>
                Best route: {best.spotVenue} spot vs {best.perpVenue} perp · {best.direction} · score {best.score}/100.
              </div>
            )}
          </div>
          <div className="mt-4">
            <FormulaExplainer
              spec={{
                title: "Cash-and-carry route equation",
                modelId: "cash-carry-lab",
                equation: best?.formula ?? "net = basis + funding - costs - stress",
                plainExplanation: "Combines public spot/perp basis, funding, trading costs, and stress haircuts to decide whether a simulated carry route is worth showing.",
              }}
            />
          </div>
          {lab.errors.length > 0 && (
            <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              Cash-and-carry degraded gracefully: {lab.errors.length} source issue(s).
            </div>
          )}
        </div>
        <div className="space-y-2">
          {visibleRoutes.map((route) => (
            <CashCarryRouteRow key={route.id} route={route} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CashCarryRouteRow({ route }: { route: CarryRoute }) {
  const tone =
    route.action === "open-carry" ? "green" : route.action === "monitor" ? "amber" : route.action === "halt" ? "red" : "neutral";
  const basisWidth = Math.max(3, Math.min(100, Math.abs(route.basisBps) * 0.8));
  const fundingWidth = Math.max(3, Math.min(100, Math.abs(route.annualizedFundingPct) * 1.2));
  const pnlTone = route.expectedNetUsd >= 0 ? "text-emerald-200" : "text-red-200";
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">
            {route.spotVenue} spot / {route.perpVenue} perp
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {route.direction} · liquidation buffer {route.liquidationBufferPct.toFixed(1)}%
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={pnlTone}>{money.format(route.expectedNetUsd)}</span>
          <Badge tone={tone}>{route.action}</Badge>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <DataCell label="Basis APR" value={`${route.annualizedBasisPct.toFixed(2)}%`} />
        <DataCell label="Funding APR" value={`${route.annualizedFundingPct.toFixed(2)}%`} />
        <DataCell label="Net APR" value={`${route.expectedNetAprPct.toFixed(2)}%`} />
        <DataCell label="Stress loss" value={money.format(route.stressLossUsd)} />
      </div>
      <div className="mt-3 space-y-2">
        <CarryBar label="basis" value={route.basisBps} width={basisWidth} unit="bps" />
        <CarryBar label="funding" value={route.annualizedFundingPct} width={fundingWidth} unit="% APR" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {route.rejectionReasons.length > 0 ? (
          route.rejectionReasons.map((reason) => <Badge key={reason} tone="amber">{reason}</Badge>)
        ) : (
          <Badge tone="green">stressed carry survives costs</Badge>
        )}
      </div>
    </div>
  );
}

function CarryBar({ label, value, width, unit }: { label: string; value: number; width: number; unit: string }) {
  return (
    <div className="grid grid-cols-[70px_1fr_88px] items-center gap-2">
      <span className="text-xs uppercase text-zinc-500">{label}</span>
      <div className="grid grid-cols-[1fr_1fr] gap-1">
        <div className="h-3 rounded bg-zinc-800">
          {value < 0 && <div className="ml-auto h-3 rounded bg-red-400" style={{ width: `${width}%` }} />}
        </div>
        <div className="h-3 rounded bg-zinc-800">
          {value >= 0 && <div className="h-3 rounded bg-emerald-400" style={{ width: `${width}%` }} />}
        </div>
      </div>
      <span className={value >= 0 ? "text-right text-xs text-emerald-200" : "text-right text-xs text-red-200"}>
        {value >= 0 ? "+" : ""}{value.toFixed(2)} {unit}
      </span>
    </div>
  );
}

function OptionsIvOracleView({ oracle }: { oracle?: OptionsIvOracle }) {
  if (!oracle) return <EmptyState text="Loading public Deribit BTC options implied volatility." />;
  const maxLiquidity = Math.max(1, ...oracle.selected.map((quote) => quote.liquidityScore));
  const tone =
    oracle.summary.regime === "calm"
      ? "green"
      : oracle.summary.regime === "elevated"
        ? "amber"
        : "red";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <DataCell label="ATM IV" value={`${oracle.summary.atmIvPct.toFixed(2)}%`} />
        <DataCell label="1h move" value={`${oracle.summary.expectedMove1hBps.toFixed(1)} bps`} />
        <DataCell label="1d move" value={`${oracle.summary.expectedMove1dBps.toFixed(1)} bps`} />
        <DataCell label="IV haircut" value={`${oracle.summary.executionHaircutBps.toFixed(2)} bps`} />
        <DataCell label="Regime" value={oracle.summary.regime} />
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.42fr_0.58fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase text-zinc-500">Forward volatility model</div>
            <Badge tone={tone}>{oracle.summary.liquidityState}</Badge>
          </div>
          <div className="space-y-3 text-sm text-zinc-300">
            <div>{oracle.explanation}</div>
            <div>
              BTC index {money.format(oracle.indexPriceUsd)} · selected {oracle.summary.selectedCount}/{oracle.summary.sourceCount} option quotes ·
              1d expected move {money.format(oracle.summary.expectedMove1dUsd)}
            </div>
          </div>
          <div className="mt-4 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            Historical volatility looks backward. This panel uses options IV to estimate what the market is pricing
            forward, then turns that expected move into a latency-sensitive execution haircut.
          </div>
        </div>
        <div className="space-y-2">
          {oracle.selected.slice(0, 6).map((quote) => (
            <OptionIvQuoteRow key={quote.instrumentName} quote={quote} maxLiquidity={maxLiquidity} />
          ))}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {oracle.termBuckets.slice(0, 6).map((bucket) => (
          <div key={bucket.expiry} className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-sm font-semibold text-zinc-100">{bucket.expiry}</div>
            <div className="mt-1 text-xs text-zinc-500">{bucket.daysToExpiry.toFixed(1)} days · {bucket.quoteCount} quotes</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <DataCell label="Median IV" value={`${bucket.medianIvPct.toFixed(1)}%`} />
              <DataCell label="OI" value={`${btc.format(bucket.openInterestBtc)} BTC`} />
            </div>
          </div>
        ))}
      </div>
      {oracle.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Options IV degraded gracefully: {oracle.errors.length} source issue(s).
        </div>
      )}
    </div>
  );
}

function OptionIvQuoteRow({ quote, maxLiquidity }: { quote: SelectedOptionIvQuote; maxLiquidity: number }) {
  const width = Math.max(4, Math.min(100, (quote.liquidityScore / maxLiquidity) * 100));
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{quote.instrumentName}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {quote.optionType} · moneyness {quote.moneynessPct >= 0 ? "+" : ""}{quote.moneynessPct.toFixed(2)}% ·{" "}
            {quote.timeToExpiryDays.toFixed(1)} days
          </div>
        </div>
        <Badge tone={quote.liquidityScore >= 45 ? "green" : quote.liquidityScore >= 20 ? "amber" : "red"}>
          IV {quote.markIvPct.toFixed(1)}%
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[92px_1fr_92px]">
        <span className="text-xs text-zinc-300">{money.format(quote.strikeUsd)}</span>
        <div className="h-3 rounded bg-zinc-800">
          <div className="h-3 rounded bg-cyan-300" style={{ width: `${width}%` }} />
        </div>
        <span className="text-right text-xs text-zinc-400">{quote.liquidityScore.toFixed(0)}/100</span>
      </div>
    </div>
  );
}

function VenueQualityView({ intelligence }: { intelligence?: VenueIntelligence }) {
  if (!intelligence) return <EmptyState text="Loading CoinGecko market-wide venue tickers." />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <DataCell label="Tracked venues" value={String(intelligence.summary.venuesTracked)} />
        <DataCell label="Median spread" value={`${intelligence.summary.medianSpreadPercent.toFixed(3)}%`} />
        <DataCell label="Tracked volume" value={compactUsd(intelligence.summary.totalVolumeUsd)} />
        <DataCell label="Best route score" value={`${intelligence.summary.bestRouteScore.toFixed(0)}/100`} />
      </div>
      <div className="space-y-2">
        {intelligence.tickers.slice(0, 9).map((ticker) => (
          <VenueQualityRow key={`${ticker.exchangeId}-${ticker.quoteAsset}`} ticker={ticker} />
        ))}
      </div>
      {intelligence.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Venue intelligence degraded gracefully: {intelligence.errors.length} source issue(s).
        </div>
      )}
    </div>
  );
}

function VenueQualityRow({ ticker }: { ticker: VenueTicker }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold capitalize text-zinc-100">
            {ticker.exchangeId} <span className="text-xs font-normal uppercase text-zinc-500">{ticker.quoteAsset}</span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            spread {ticker.spreadPercent.toFixed(3)}% · volume {compactUsd(ticker.volumeUsd)} · trust {ticker.trustScore}
          </div>
        </div>
        <Badge tone={ticker.qualityScore >= 75 ? "green" : ticker.qualityScore >= 55 ? "amber" : "red"}>
          {ticker.qualityScore}/100
        </Badge>
      </div>
      <div className="mt-3 h-2 rounded bg-zinc-800">
        <div className="h-2 rounded bg-cyan-300" style={{ width: `${ticker.qualityScore}%` }} />
      </div>
    </div>
  );
}

function VenueRoutesView({
  intelligence,
  best,
}: {
  intelligence?: VenueIntelligence;
  best?: OpportunityDecision;
}) {
  if (!intelligence) return <EmptyState text="Loading market-wide route candidates." />;
  if (intelligence.routes.length === 0) {
    return <EmptyState text="No positive same-lane market-wide route candidates in the latest CoinGecko snapshot." />;
  }
  return (
    <div className="space-y-4">
      {best && (
        <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
          Live engine route: <span className="capitalize">{best.buyExchange} → {best.sellExchange}</span>. Market Map is a slower,
          broader sanity check from CoinGecko tickers; the engine still decides from executable L2 books.
        </div>
      )}
      <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
        {intelligence.routes.slice(0, 10).map((route) => (
          <VenueRouteRow key={`${route.quoteAsset}-${route.buyExchange}-${route.sellExchange}`} route={route} />
        ))}
      </div>
    </div>
  );
}

function VenueRouteRow({ route }: { route: VenueRoute }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold capitalize text-zinc-100">
          {route.buyExchange} → {route.sellExchange}
        </span>
        <Badge tone={route.routeScore >= 70 ? "green" : route.routeScore >= 45 ? "amber" : "neutral"}>
          score {route.routeScore.toFixed(0)}
        </Badge>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-zinc-400 sm:grid-cols-4">
        <span>{route.quoteAsset}</span>
        <span>{route.grossSpreadBps.toFixed(2)} bps gross</span>
        <span>quality {route.combinedQuality.toFixed(0)}/100</span>
        <span>floor {compactUsd(route.volumeFloorUsd)}</span>
      </div>
    </div>
  );
}

function LiquidityRadarView({ radar }: { radar?: LiquidityRadar }) {
  if (!radar) return <EmptyState text="Loading executable REST snapshots from Coinbase, Kraken, Bitstamp, Bitfinex, OKX, Gemini, and KuCoin." />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DataCell label="Loaded venues" value={String(radar.summary.venuesLoaded)} />
        <DataCell label="USD / USDT venues" value={`${radar.summary.usdVenues}/${radar.summary.usdtVenues}`} />
        <DataCell label="Executable routes" value={`${radar.summary.executableRoutes}/${radar.summary.routeCount}`} />
        <DataCell label="Best net route" value={money.format(radar.summary.bestNetProfitUsd)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
        <div className="space-y-2">
          <div className="text-xs uppercase text-zinc-500">Venue books</div>
          <div className="grid gap-2 md:grid-cols-2">
            {radar.books.map((book) => (
              <LiquidityBookCard key={`${book.exchangeId}-${book.quoteAsset}`} book={book} />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="mb-3 text-xs uppercase text-zinc-500">Execution frontier</div>
            <LiquidityFrontierChart radar={radar} />
          </div>
          <div className="max-h-[430px] space-y-2 overflow-auto pr-1">
            {radar.routes.slice(0, 8).map((route) => (
              <LiquidityRouteRow key={`${route.quoteAsset}-${route.buyExchange}-${route.sellExchange}`} route={route} />
            ))}
          </div>
        </div>
      </div>
      {radar.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Liquidity radar degraded gracefully: {radar.errors.length} source issue(s).
        </div>
      )}
      <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
        REST radar is a broad, no-key venue sweep. It keeps USD and USDT separated and re-walks both sides of
        every route, so it is slower than the WebSocket engine but stronger as external evidence.
      </div>
    </div>
  );
}

function LiquidityBookCard({ book }: { book: LiquidityVenueBook }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold capitalize text-zinc-100">{book.exchangeId}</div>
          <div className="mt-1 text-xs uppercase text-zinc-500">{book.quoteAsset}</div>
        </div>
        <Badge tone={book.spreadBps <= 5 ? "green" : book.spreadBps <= 15 ? "amber" : "red"}>
          {Math.max(0, book.spreadBps).toFixed(2)} bps
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DataCell label="Bid" value={money.format(book.topBid)} />
        <DataCell label="Ask" value={money.format(book.topAsk)} />
        <DataCell label="Bid depth" value={`${btc.format(book.bidDepthBtc)} BTC`} />
        <DataCell label="Ask depth" value={`${btc.format(book.askDepthBtc)} BTC`} />
      </div>
    </div>
  );
}

function LiquidityRouteRow({ route }: { route: LiquidityRoute }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold capitalize text-zinc-100">
            {route.buyExchange} → {route.sellExchange}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {route.quoteAsset} · {btc.format(route.tradeSizeBtc)} BTC · buy {money.format(route.buyVwap)} / sell {money.format(route.sellVwap)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={route.netProfitUsd >= 0 ? "text-emerald-200" : "text-red-200"}>
            {money.format(route.netProfitUsd)}
          </span>
          <Badge tone={route.complete ? "green" : "red"}>{route.complete ? "executable" : "reject"}</Badge>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-4">
        <span>{route.edgeBps.toFixed(2)} bps net</span>
        <span>fees {money.format(route.feeCostUsd)}</span>
        <span>rebalance {money.format(route.rebalanceCostUsd)}</span>
        <span>score {route.routeScore.toFixed(0)}/100</span>
      </div>
      {route.rejectionReasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {route.rejectionReasons.map((reason) => (
            <Badge key={reason} tone="amber">
              {reason}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function LiquidityFrontierChart({ radar }: { radar: LiquidityRadar }) {
  const points = radar.frontier;
  if (points.length === 0) return <EmptyState text="No route frontier available. The REST radar needs at least one executable size bucket." />;
  const values = points.map((point) => point.bestNetProfitUsd);
  const summary = summarizeChartSeries(values);
  const domain = chartDomain(values);
  const chartPoints = buildPolylinePoints(values, { width: 100, height: 100, padding: 8 });
  const zeroY = 8 + (1 - (0 - domain.min) / domain.range) * 84;
  return (
    <ChartFrame
      title="Execution frontier"
      source="REST snapshots"
      description="Best net P&L by simulated trade size. Axis is scaled defensively so flat and negative data still render."
      metrics={[
        { label: "Buckets", value: String(summary.count), tone: "neutral" },
        { label: "Best", value: money.format(summary.max), tone: summary.max >= 0 ? "green" : "red" },
        { label: "Range", value: `${money.format(summary.min)} to ${money.format(summary.max)}`, tone: "cyan" },
      ]}
    >
      <AccessibleChartSvg
        title="Execution frontier curve"
        description="Best net profit by simulated trade size from REST order book snapshots."
        className="h-36"
      >
        <line x1="8" y1={Math.max(8, Math.min(92, zeroY))} x2="92" y2={Math.max(8, Math.min(92, zeroY))} stroke="rgb(63 63 70)" strokeWidth="1" />
        <polyline points={polylineAttribute(chartPoints)} fill="none" stroke="rgb(34 211 238)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => {
          const chartPoint = chartPoints[index];
          return (
            <circle
              key={point.sizeBtc}
              cx={chartPoint.x}
              cy={chartPoint.y}
              r="2.3"
              fill={point.bestNetProfitUsd >= 0 ? "rgb(52 211 153)" : "rgb(248 113 113)"}
            />
          );
        })}
      </AccessibleChartSvg>
      <div className="mb-2 flex justify-between text-[11px] text-zinc-500">
        <span>{money.format(domain.min)}</span>
        <span>{money.format(domain.max)}</span>
      </div>
      <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-5">
        {points.map((point) => (
          <div key={point.sizeBtc} className="rounded border border-zinc-800 bg-zinc-950 p-2">
            <div className="font-medium text-zinc-200">{btc.format(point.sizeBtc)} BTC</div>
            <div>{money.format(point.bestNetProfitUsd)}</div>
            <div>{point.executableRoutes} executable</div>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}

function ArbitrageGraphView({ graph, compact = false }: { graph: CrossVenueArbitrageGraph; compact?: boolean }) {
  const tone =
    graph.summary.policy === "execute-cycle"
      ? "green"
      : graph.summary.policy === "watch-graph"
        ? "amber"
        : graph.summary.policy === "no-cycle"
          ? "neutral"
          : "red";
  const visibleCycles = compact ? graph.cycles.slice(0, 2) : graph.cycles.slice(0, 5);
  const visibleEdges = compact ? graph.edges.slice(0, 6) : graph.edges.slice(0, 12);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase text-zinc-500">Graph policy</div>
              <div className="mt-1 text-3xl font-semibold uppercase text-white">{graph.summary.policy}</div>
            </div>
            <Badge tone={tone}>{graph.summary.hasNegativeCycle ? "negative cycle" : "no cycle"}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <DataCell label="Nodes" value={String(graph.summary.nodeCount)} />
            <DataCell label="Edges" value={String(graph.summary.edgeCount)} />
            <DataCell label="Cycles" value={String(graph.summary.cycleCount)} />
            <DataCell label="Proof score" value={`${graph.summary.proofScore}/100`} />
            <DataCell label="Best P&L" value={money.format(graph.summary.bestCyclePnlUsd)} />
            <DataCell label="Best edge" value={`${graph.summary.bestCycleBps.toFixed(2)} bps`} />
          </div>
          <FormulaExplainer
            spec={{
              modelId: "arbitrage-graph",
              title: "Negative-cycle proof",
              equation: graph.equation,
              plainExplanation:
                "Transforms exchange rates into negative log weights. A negative cycle is mathematical evidence that a route remains profitable after modeled costs.",
              variables: [
                { symbol: "nodes", label: "graph nodes", value: graph.summary.nodeCount },
                { symbol: "edges", label: "weighted edges", value: graph.summary.edgeCount },
                { symbol: "best_cycle", label: "best cycle P&L", value: money.format(graph.summary.bestCyclePnlUsd) },
              ],
            }}
          />
        </div>
        <div className="space-y-3">
          {visibleCycles.length > 0 ? (
            visibleCycles.map((cycle) => <ArbitrageCycleCard key={cycle.id} cycle={cycle} compact={compact} />)
          ) : (
            <EmptyState text={graph.reasons[0] ?? "Waiting for public route evidence before graph proof."} />
          )}
        </div>
      </div>
      {!compact && (
        <div className="grid gap-2 lg:grid-cols-2">
          {visibleEdges.map((edge) => (
            <ArbitrageEdgeRow key={edge.id} edge={edge} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArbitrageCycleCard({ cycle, compact }: { cycle: ArbitrageGraphCycle; compact: boolean }) {
  const visibleEdges = compact ? cycle.edges.slice(0, 3) : cycle.edges;
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{cycle.label}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {cycle.nodes.length} nodes · {cycle.edges.length} weighted edges · weight {cycle.negativeWeight.toFixed(6)}
          </div>
        </div>
        <Badge tone={cycle.netPnlUsd > 0 ? "green" : "red"}>{cycle.complete ? "closed cycle" : "reject"}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <DataCell label="Start" value={money.format(cycle.startAmountUsd)} />
        <DataCell label="Final" value={money.format(cycle.finalAmountUsd)} />
        <DataCell label="Net P&L" value={money.format(cycle.netPnlUsd)} />
        <DataCell label="Net edge" value={`${cycle.netPnlBps.toFixed(2)} bps`} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {cycle.sourceMix.map((source) => (
          <Badge key={source} tone="cyan">
            {source}
          </Badge>
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        {visibleEdges.map((edge) => (
          <div key={edge.id} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-200">
                {edge.from} {"->"} {edge.to}
              </span>
              <span className={edge.weight < 0 ? "text-emerald-200" : "text-zinc-400"}>
                w={edge.weight.toFixed(6)}
              </span>
            </div>
            <div className="mt-1">{edge.evidence}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArbitrageEdgeRow({ edge }: { edge: ArbitrageGraphEdge }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">
            {edge.from} {"->"} {edge.to}
          </div>
          <div className="mt-1 text-xs uppercase text-zinc-500">{edge.source} · {edge.venue}</div>
        </div>
        <Badge tone={edge.weight < 0 ? "green" : "neutral"}>w {edge.weight.toFixed(5)}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-400">
        <span>rate {edge.rate.toPrecision(5)}</span>
        <span>cap {money.format(edge.capacityUsd)}</span>
        <span>P&L {money.format(edge.expectedPnlUsd)}</span>
      </div>
    </div>
  );
}

function LiquidityTopologyView({ map, compact = false }: { map: LiquidityTopologyMap; compact?: boolean }) {
  const tone =
    map.summary.policy === "route-normal"
      ? "green"
      : map.summary.policy === "prefer-central-venues"
        ? "amber"
        : map.summary.policy === "avoid-fragmented-route"
          ? "red"
          : "neutral";
  const visibleVenues = compact ? map.venues.slice(0, 5) : map.venues;
  const visibleLinks = compact ? map.links.slice(0, 5) : map.links.slice(0, 10);
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="min-w-0 rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Topology policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{map.summary.policy}</div>
          </div>
          <Badge tone={tone}>{map.summary.fragmentationScore}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Central venue" value={map.summary.centralVenue ?? "none"} />
          <DataCell label="Venues" value={String(map.summary.venueCount)} />
          <DataCell label="Median W1" value={`${map.summary.medianDistanceBps.toFixed(2)} bps`} />
          <DataCell label="Max W1" value={`${map.summary.maxDistanceBps.toFixed(2)} bps`} />
          <DataCell label="Haircut" value={`${map.summary.topologyHaircutBps.toFixed(2)} bps`} />
          <DataCell label="Outliers" value={String(map.outliers.length)} />
        </div>
        <div className="mt-4">
          <FormulaExplainer
            spec={{
              title: "Liquidity topology equation",
              modelId: "liquidity-topology",
              equation: map.equation,
              plainExplanation: "Uses order-book shape distance to penalize routes where the apparent top-of-book edge is not supported by similar depth geometry.",
            }}
          />
        </div>
        {!compact && (
          <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            Compares the shape of public L2 books, not just top bid/ask. Large Wasserstein distances mean liquidity is
            sitting at different price depths, so a route can look tradable while its depth geometry is fragile.
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-4">
        {map.summary.policy === "insufficient-data" ? (
          <EmptyState text={map.reasons[0] ?? "Waiting for same-lane books."} />
        ) : (
          <>
            <TopologyNetwork venues={visibleVenues} links={visibleLinks} />
            <div className="grid min-w-0 gap-2 md:grid-cols-2">
              {visibleLinks.map((link) => (
                <TopologyLinkRow key={`${link.fromExchange}-${link.toExchange}`} link={link} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {map.reasons.map((reason) => (
                <Badge key={reason} tone={tone}>
                  {reason}
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TopologyNetwork({ venues, links }: { venues: LiquidityTopologyVenue[]; links: LiquidityTopologyLink[] }) {
  if (venues.length === 0) return <EmptyState text="No topology venues available." />;
  const maxDistance = Math.max(1, ...links.map((link) => link.wassersteinBps));
  return (
    <div className="min-w-0 rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Order-book shape network</div>
          <div className="text-xs text-zinc-500">node score = centrality, link opacity = W1 distance</div>
        </div>
        <Badge tone="cyan">optimal transport</Badge>
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {venues.map((venue) => (
          <div key={venue.exchangeId} className="min-w-0 rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold capitalize text-zinc-100">{venue.exchangeId}</div>
              <Badge tone={venue.topologyRisk === "central" ? "green" : venue.topologyRisk === "watch" ? "amber" : "red"}>
                {venue.centralityScore}/100
              </Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
              <span>{venue.quoteAsset}</span>
              <span className="text-right">{venue.averageDistanceBps.toFixed(2)} W1</span>
              <span>{btc.format(venue.totalDepthBtc)} BTC</span>
              <span className="text-right">{venue.spreadBps.toFixed(2)} bps spread</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1">
        {links.slice(0, 6).map((link) => (
          <div key={`${link.fromExchange}-${link.toExchange}-bar`} className="grid min-w-0 grid-cols-[minmax(92px,150px)_minmax(0,1fr)_48px] items-center gap-2 text-xs">
            <span className="capitalize text-zinc-400">{link.fromExchange} - {link.toExchange}</span>
            <div className="h-2 rounded bg-zinc-800">
              <div
                className="h-2 rounded bg-cyan-400"
                style={{ width: `${Math.max(4, (link.wassersteinBps / maxDistance) * 100)}%` }}
              />
            </div>
            <span className="text-right text-zinc-300">{link.wassersteinBps.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopologyLinkRow({ link }: { link: LiquidityTopologyLink }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold capitalize text-zinc-100">
          {link.fromExchange} - {link.toExchange}
        </div>
        <Badge tone={link.wassersteinBps > 24 ? "red" : link.wassersteinBps > 12 ? "amber" : "green"}>
          W1 {link.wassersteinBps.toFixed(2)}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400 md:grid-cols-4">
        <span>bid {link.bidDistanceBps.toFixed(2)}</span>
        <span>ask {link.askDistanceBps.toFixed(2)}</span>
        <span>depth {btc.format(link.sharedDepthBtc)} BTC</span>
        <span>penalty {link.routingPenaltyBps.toFixed(2)} bps</span>
      </div>
    </div>
  );
}

function SmartOrderRouterView({ plan, compact = false }: { plan: SmartOrderRouterPlan; compact?: boolean }) {
  if (plan.summary.policy === "standby") {
    return <EmptyState text="Loading public REST order books before solving the multi-venue smart route." />;
  }
  const tone =
    plan.summary.policy === "split-route"
      ? "green"
      : plan.summary.policy === "single-route" || plan.summary.policy === "cap-size"
        ? "amber"
        : "red";
  const visibleBuys = compact ? plan.buySlices.slice(0, 4) : plan.buySlices;
  const visibleSells = compact ? plan.sellSlices.slice(0, 4) : plan.sellSlices;
  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Routing policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{plan.summary.policy}</div>
          </div>
          <Badge tone={tone}>{plan.summary.venuesUsed} venues</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Size" value={`${btc.format(plan.summary.tradeSizeBtc)} BTC`} />
          <DataCell label="Net P&L" value={money.format(plan.summary.netProfitUsd)} />
          <DataCell label="Improvement" value={money.format(plan.summary.improvementUsd)} />
          <DataCell label="Single route" value={money.format(plan.summary.bestSingleRouteNetUsd)} />
          <DataCell label="Buy VWAP" value={money.format(plan.summary.buyVwap)} />
          <DataCell label="Sell VWAP" value={money.format(plan.summary.sellVwap)} />
          <DataCell label="Fees" value={money.format(plan.summary.feeCostUsd)} />
          <DataCell label="Reliability cut" value={money.format(plan.summary.reliabilityHaircutUsd)} />
        </div>
        <FormulaExplainer
          spec={{
            modelId: "smart-router",
            title: "Multi-venue sweep objective",
            equation: plan.equation,
            plainExplanation:
              "Solves a simulated multi-venue sweep over public L2 depth: buy cheapest effective asks and sell richest effective bids while respecting prefunded wallets and reliability gates.",
            variables: [
              { symbol: "size", label: "target size", value: `${btc.format(plan.summary.tradeSizeBtc)} BTC` },
              { symbol: "net", label: "net P&L", value: money.format(plan.summary.netProfitUsd) },
              { symbol: "improvement", label: "router improvement", value: money.format(plan.summary.improvementUsd) },
            ],
          }}
        />
        {plan.rejectionReasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.rejectionReasons.map((reason) => (
              <Badge key={reason} tone={reason.includes("negative") || reason.includes("halt") ? "red" : "amber"}>
                {reason}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SmartOrderSliceTable title="Buy sweep" slices={visibleBuys} />
        <SmartOrderSliceTable title="Sell sweep" slices={visibleSells} />
      </div>
    </div>
  );
}

function SmartOrderSliceTable({ title, slices }: { title: string; slices: SmartOrderSlice[] }) {
  if (slices.length === 0) return <EmptyState text={`${title} has no executable slices under the current constraints.`} />;
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs uppercase text-zinc-500">{title}</div>
        <Badge tone="neutral">{slices.length} slices</Badge>
      </div>
      <div className="space-y-2">
        {slices.map((slice, index) => (
          <div key={`${slice.side}-${slice.exchangeId}-${slice.levelIndex}-${index}`} className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold capitalize text-zinc-100">{slice.exchangeId}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  level {slice.levelIndex + 1} · {slice.quoteAsset} · effective {money.format(slice.effectivePriceUsd)}
                </div>
              </div>
              <Badge tone={slice.walletLimited ? "amber" : "green"}>{slice.walletLimited ? "wallet cap" : "filled"}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <DataCell label="BTC" value={`${btc.format(slice.sizeBtc)} BTC`} />
              <DataCell label="Price" value={money.format(slice.price)} />
              <DataCell label="Notional" value={money.format(slice.notionalUsd)} />
              <DataCell label="Fee" value={money.format(slice.feeUsd)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceConsensusOracleView({ oracle }: { oracle?: PriceConsensusOracle }) {
  if (!oracle) return <EmptyState text="Loading multi-venue BTC price consensus." />;
  const maxPremium = Math.max(1, ...oracle.venues.map((venue) => Math.abs(venue.premiumBps)));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DataCell label="Consensus BTC" value={money.format(oracle.consensusPriceUsd)} />
        <DataCell label="Confidence" value={oracle.summary.confidence} />
        <DataCell label="Outliers" value={String(oracle.summary.outlierCount)} />
        <DataCell label="Max premium" value={`${oracle.summary.maxPremiumBps.toFixed(1)} bps`} />
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.42fr_0.58fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 text-xs uppercase text-zinc-500">Robust consensus model</div>
          <div className="space-y-3 text-sm text-zinc-300">
            <div>{oracle.explanation}</div>
            <div>
              MAD: {money.format(oracle.medianAbsoluteDeviationUsd)} · normal {oracle.summary.normalCount} · stale {oracle.summary.staleCount}
            </div>
          </div>
          <div className="mt-4 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            A route gets more credible when executable books agree with this consensus. Large robust z-scores
            expose local premiums, stale tickers, or venue-specific dislocations before the simulator trusts a spread.
          </div>
        </div>
        <div className="space-y-2">
          {oracle.venues.map((venue) => (
            <PriceConsensusVenueRow key={`${venue.venue}-${venue.pair}`} venue={venue} maxPremium={maxPremium} />
          ))}
        </div>
      </div>
      {oracle.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Price consensus degraded gracefully: {oracle.errors.length} source issue(s).
        </div>
      )}
    </div>
  );
}

function PriceConsensusVenueRow({ venue, maxPremium }: { venue: ConsensusVenue; maxPremium: number }) {
  const width = Math.max(4, Math.min(100, (Math.abs(venue.premiumBps) / maxPremium) * 100));
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{venue.label}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {venue.pair} · {venue.quoteAsset} · robust z {venue.robustZScore.toFixed(2)}
          </div>
        </div>
        <Badge tone={venue.state === "normal" ? "green" : venue.state === "watch" ? "amber" : "red"}>
          {venue.state}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[115px_1fr_92px_90px]">
        <span className="text-xs text-zinc-300">{money.format(venue.priceUsd)}</span>
        <div className="grid grid-cols-[1fr_1fr] gap-1">
          <div className="h-3 rounded bg-zinc-800">
            {venue.premiumBps < 0 && <div className="ml-auto h-3 rounded bg-red-400" style={{ width: `${width}%` }} />}
          </div>
          <div className="h-3 rounded bg-zinc-800">
            {venue.premiumBps >= 0 && <div className="h-3 rounded bg-emerald-400" style={{ width: `${width}%` }} />}
          </div>
        </div>
        <span className={venue.premiumBps >= 0 ? "text-right text-xs text-emerald-200" : "text-right text-xs text-red-200"}>
          {venue.premiumBps >= 0 ? "+" : ""}{venue.premiumBps.toFixed(1)} bps
        </span>
        <span className="text-right text-xs text-zinc-500">{Math.round(venue.ageMs / 1000)}s old</span>
      </div>
    </div>
  );
}

function UsdtBasisOracleView({ oracle }: { oracle?: UsdtBasisOracle }) {
  if (!oracle) return <EmptyState text="Loading public USDT/USD basis from Coinbase, Kraken, Bitstamp, and CoinGecko." />;
  const maxBasis = Math.max(1, ...oracle.venues.map((venue) => Math.abs(venue.basisBps)));
  const tone =
    oracle.summary.policy === "cross-lane-ok"
      ? "green"
      : oracle.summary.policy === "haircut-required"
        ? "amber"
        : "red";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <DataCell label="Median USDT/USD" value={oracle.medianUsdtUsd.toFixed(6)} />
        <DataCell label="Basis" value={`${oracle.basisBps >= 0 ? "+" : ""}${oracle.basisBps.toFixed(2)} bps`} />
        <DataCell label="Haircut" value={`${oracle.summary.dynamicHaircutBps.toFixed(2)} bps`} />
        <DataCell label="Sources" value={String(oracle.summary.sourceCount)} />
        <DataCell label="Confidence" value={oracle.summary.confidence} />
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.42fr_0.58fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase text-zinc-500">Cross-lane policy</div>
            <Badge tone={tone}>{oracle.summary.policy}</Badge>
          </div>
          <div className="space-y-3 text-sm text-zinc-300">
            <div>{oracle.explanation}</div>
            <div>
              dispersion {oracle.dispersionBps.toFixed(2)} bps · normal {oracle.summary.normalCount} · watch{" "}
              {oracle.summary.watchCount} · stale {oracle.summary.staleCount} · depeg {oracle.summary.depegCount}
            </div>
          </div>
          <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
            This protects the simulator from pretending BTC/USD and BTC/USDT are identical. Cross-lane routes must
            first pay this public-market basis haircut, and the policy halts them during material USDT depeg risk.
          </div>
        </div>
        <div className="space-y-2">
          {oracle.venues.map((venue) => (
            <UsdtBasisVenueRow key={`${venue.venue}-${venue.pair}`} venue={venue} maxBasis={maxBasis} />
          ))}
        </div>
      </div>
      {oracle.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          USDT basis degraded gracefully: {oracle.errors.length} source issue(s).
        </div>
      )}
    </div>
  );
}

function UsdtBasisVenueRow({ venue, maxBasis }: { venue: UsdtBasisVenue; maxBasis: number }) {
  const width = Math.max(4, Math.min(100, (Math.abs(venue.basisBps) / maxBasis) * 100));
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{venue.label}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {venue.pair} · spread {venue.spreadBps.toFixed(2)} bps · median premium{" "}
            {venue.premiumToMedianBps >= 0 ? "+" : ""}
            {venue.premiumToMedianBps.toFixed(2)} bps
          </div>
        </div>
        <Badge tone={venue.state === "normal" ? "green" : venue.state === "watch" ? "amber" : "red"}>
          {venue.state}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[92px_1fr_82px_90px]">
        <span className="text-xs text-zinc-300">{venue.priceUsd.toFixed(6)}</span>
        <div className="grid grid-cols-[1fr_1fr] gap-1">
          <div className="h-3 rounded bg-zinc-800">
            {venue.basisBps < 0 && <div className="ml-auto h-3 rounded bg-red-400" style={{ width: `${width}%` }} />}
          </div>
          <div className="h-3 rounded bg-zinc-800">
            {venue.basisBps >= 0 && <div className="h-3 rounded bg-emerald-400" style={{ width: `${width}%` }} />}
          </div>
        </div>
        <span className={venue.basisBps >= 0 ? "text-right text-xs text-emerald-200" : "text-right text-xs text-red-200"}>
          {venue.basisBps >= 0 ? "+" : ""}{venue.basisBps.toFixed(2)} bps
        </span>
        <span className="text-right text-xs text-zinc-500">{Math.round(venue.ageMs / 1000)}s old</span>
      </div>
    </div>
  );
}

function MexicoCorridorBooksView({ lab }: { lab?: MexicoCorridorLab }) {
  if (!lab) return <EmptyState text="Loading Bitso BTC/MXN, Bitso USD/MXN, and Coinbase BTC/USD public books." />;
  const rows = Object.entries(lab.books) as Array<[keyof MexicoCorridorLab["books"], MexicoCorridorLab["books"][keyof MexicoCorridorLab["books"]]]>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <DataCell label="Target size" value={`${btc.format(lab.targetSizeBtc)} BTC`} />
        <DataCell label="Executable routes" value={`${lab.summary.executableRoutes}/${lab.routes.length}`} />
        <DataCell label="USD/MXN bid" value={lab.summary.impliedUsdMxnBid.toFixed(4)} />
        <DataCell label="USD/MXN ask" value={lab.summary.impliedUsdMxnAsk.toFixed(4)} />
      </div>
      <div className="space-y-2">
        {rows.map(([pair, book]) => (
          <div key={pair} className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-100">{pair}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  top depth bid {btc.format(book.bidSize)} / ask {btc.format(book.askSize)}
                </div>
              </div>
              <Badge tone={book.bid > 0 && book.ask > 0 ? "green" : "amber"}>{book.sequence ? `seq ${book.sequence}` : "public"}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <DataCell label="Bid" value={formatMexicoPrice(pair, book.bid)} />
              <DataCell label="Ask" value={formatMexicoPrice(pair, book.ask)} />
            </div>
          </div>
        ))}
      </div>
      {lab.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Mexico Corridor degraded gracefully: {lab.errors.length} source issue(s).
        </div>
      )}
      <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
        This corridor does not use a static FX rate. It walks Bitso USD/MXN depth to convert MXN proceeds
        or fund MXN purchases, then compares the result against executable Coinbase BTC/USD depth.
      </div>
    </div>
  );
}

function MexicoCorridorRoutesView({ lab }: { lab?: MexicoCorridorLab }) {
  if (!lab) return <EmptyState text="Loading Mexico cross-currency route simulation." />;
  if (lab.routes.length === 0) return <EmptyState text="Mexico corridor requires all three public books." />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DataCell label="Best route" value={lab.summary.bestRouteLabel} />
        <DataCell label="Best net P&L" value={money.format(lab.summary.bestNetPnlUsd)} />
        <DataCell label="Coinbase fee" value={`${lab.assumptions.coinbaseFeeBps} bps`} />
        <DataCell label="Bitso/FX fees" value={`${lab.assumptions.bitsoFeeBps}/${lab.assumptions.fxFeeBps} bps`} />
      </div>
      {lab.routes.map((route) => (
        <MexicoCorridorRouteCard key={route.id} route={route} />
      ))}
    </div>
  );
}

function MexicoCorridorRouteCard({ route }: { route: MexicoCorridorRoute }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{route.label}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {btc.format(route.tradeSizeBtc)} BTC · {route.netPnlBps.toFixed(2)} bps · score {route.routeScore.toFixed(0)}/100
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={route.netPnlUsd >= 0 ? "text-emerald-200" : "text-red-200"}>{money.format(route.netPnlUsd)}</span>
          <Badge tone={route.complete ? "green" : "red"}>{route.complete ? "sim accept" : "reject"}</Badge>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <DataCell label="Start USD" value={money.format(route.startUsd)} />
        <DataCell label="Final USD" value={money.format(route.finalUsd)} />
        <DataCell label="Gross edge" value={money.format(route.grossEdgeUsd)} />
        <DataCell label="Rebalance" value={money.format(route.rebalanceCostUsd)} />
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        {route.legs.map((leg, index) => (
          <MexicoCorridorLegView key={`${route.id}-${leg.pair}-${index}`} leg={leg} index={index + 1} />
        ))}
      </div>
      <div className="mt-3 rounded border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-300">
        {route.explanation}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {route.rejectionReasons.length > 0 ? (
          route.rejectionReasons.map((reason) => <Badge key={reason} tone="amber">{reason}</Badge>)
        ) : (
          <Badge tone="green">cross-currency edge survives executable FX</Badge>
        )}
      </div>
    </div>
  );
}

function MexicoCorridorLegView({ leg, index }: { leg: MexicoCorridorLeg; index: number }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase text-zinc-500">Leg {index}</div>
        <Badge tone={leg.complete ? "green" : "amber"}>{leg.action}</Badge>
      </div>
      <div className="mt-2 text-sm font-semibold text-zinc-100">{leg.venue} · {leg.pair}</div>
      <div className="mt-2 space-y-1 text-xs text-zinc-400">
        <div>{formatMexicoAmount(leg.inputAmount, leg.inputAsset)} → {formatMexicoAmount(leg.outputAmount, leg.outputAsset)}</div>
        <div>VWAP {formatMexicoPrice(leg.pair, leg.vwap)} · fee {formatMexicoAmount(leg.feeAmount, leg.outputAsset)}</div>
        <div>{leg.levelsUsed} level(s) walked</div>
      </div>
    </div>
  );
}

function TriangularBooksView({ lab }: { lab?: TriangularLab }) {
  if (!lab) return <EmptyState text="Loading Coinbase public L2 books for BTC-USD, ETH-USD, and ETH-BTC." />;
  const rows = Object.entries(lab.books);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <DataCell label="Venue" value="Coinbase" />
        <DataCell label="Start capital" value={money.format(lab.startUsd)} />
        <DataCell label="Taker fee" value={`${lab.feeBps} bps/leg`} />
        <DataCell label="Paths simulated" value={String(lab.routes.length)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase text-zinc-500">
              <th className="py-2 pr-3">Pair</th>
              <th className="py-2 pr-3 text-right">Bid</th>
              <th className="py-2 pr-3 text-right">Ask</th>
              <th className="py-2 pr-3 text-right">Top bid size</th>
              <th className="py-2 pr-3 text-right">Top ask size</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([pair, book]) => (
              <tr key={pair} className="border-b border-zinc-900 text-zinc-300">
                <td className="py-2 pr-3 font-medium text-zinc-100">{pair}</td>
                <td className="py-2 pr-3 text-right">{formatPairPrice(pair, book.bid)}</td>
                <td className="py-2 pr-3 text-right">{formatPairPrice(pair, book.ask)}</td>
                <td className="py-2 pr-3 text-right">{btc.format(book.bidSize)}</td>
                <td className="py-2 pr-3 text-right">{btc.format(book.askSize)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lab.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Triangular lab degraded gracefully: {lab.errors.length} source issue(s).
        </div>
      )}
      <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-xs leading-5 text-zinc-300">
        This is single-venue triangular arbitrage: every leg walks a real Coinbase L2 book and pays taker fees.
        It does not place orders or require account access.
      </div>
    </div>
  );
}

function TriangularRoutesView({ lab }: { lab?: TriangularLab }) {
  if (!lab) return <EmptyState text="Loading triangular route simulation." />;
  if (lab.routes.length === 0) return <EmptyState text="Triangular routes require all three Coinbase books." />;
  const ranked = [...lab.routes].sort((a, b) => b.netPnlUsd - a.netPnlUsd);
  return (
    <div className="space-y-4">
      {ranked.map((route) => (
        <TriangularRouteCard key={route.id} route={route} />
      ))}
    </div>
  );
}

function TriangularRouteCard({ route }: { route: TriangularRoute }) {
  const accepted = route.rejectionReasons.length === 0;
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{route.label}</div>
          <div className="mt-1 text-xs text-zinc-500">{route.explanation}</div>
        </div>
        <Badge tone={accepted ? "green" : "red"}>{accepted ? "simulated accept" : "reject"}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <DataCell label="Final USD" value={money.format(route.finalUsd)} />
        <DataCell label="Net P&L" value={money.format(route.netPnlUsd)} />
        <DataCell label="Net edge" value={`${route.netPnlBps.toFixed(2)} bps`} />
        <DataCell label="Depth" value={route.complete ? "complete" : "partial"} />
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        {route.legs.map((leg, index) => (
          <TriangularLegView key={`${route.id}-${leg.pair}-${index}`} leg={leg} index={index + 1} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {route.rejectionReasons.length > 0 ? (
          route.rejectionReasons.map((reason) => <Badge key={reason} tone="amber">{reason}</Badge>)
        ) : (
          <Badge tone="green">three-leg edge survives fees</Badge>
        )}
      </div>
    </div>
  );
}

function TriangularLegView({ leg, index }: { leg: TriangularLeg; index: number }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase text-zinc-500">Leg {index}</div>
        <Badge tone={leg.complete ? "green" : "amber"}>{leg.action}</Badge>
      </div>
      <div className="mt-2 text-sm font-semibold text-zinc-100">{leg.pair}</div>
      <div className="mt-2 space-y-1 text-xs text-zinc-400">
        <div>{formatAssetAmount(leg.inputAmount, leg.inputAsset)} → {formatAssetAmount(leg.outputAmount, leg.outputAsset)}</div>
        <div>VWAP {formatPairPrice(leg.pair, leg.vwap)} · fee {formatAssetAmount(leg.feeAmount, leg.outputAsset)}</div>
        <div>{leg.levelsUsed} level(s) walked</div>
      </div>
    </div>
  );
}

function QuantLab({ decision, context }: { decision?: OpportunityDecision; context?: MarketContext }) {
  if (!decision) return <EmptyState text="Start live feeds or replay to generate a quant analysis." />;
  const realizedVol = context?.volatility.realizedVolBpsPerSecond ?? 0;
  const riskCone = useMemo(
    () => buildLatencyRiskCone(decision, realizedVol),
    [decision, realizedVol],
  );
  const monteCarlo = useMemo(
    () =>
      runMonteCarloExecution({
        decision,
        realizedVolBpsPerSecond: realizedVol,
        trials: 2_000,
        horizonMs: 1_000,
        bins: 18,
      }),
    [decision, realizedVol],
  );
  const kellySizing = useMemo(
    () =>
      deriveKellySizing({
        decision,
        simulation: monteCarlo,
        bankrollUsd: 100_000,
        fraction: 0.25,
        maxFraction: 0.08,
      }),
    [decision, monteCarlo],
  );
  const waterfall = useMemo(() => buildPnlWaterfall(decision), [decision]);
  const depthLens = useMemo(() => buildExecutionDepthLens(decision), [decision]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <DataCell label="Execution probability" value={`${(decision.risk.positivePnlProbability * 100).toFixed(1)}%`} />
        <DataCell label="Historical vol input" value={`${(context?.volatility.realizedVolBpsPerSecond ?? 0).toFixed(2)} bps/s`} />
        <DataCell label="Buy microprice" value={money.format(decision.microstructure.buy.microprice)} />
        <DataCell label="Sell microprice" value={money.format(decision.microstructure.sell.microprice)} />
        <DataCell label="Buy imbalance" value={`${(decision.microstructure.buy.imbalance * 100).toFixed(1)}% ${decision.microstructure.buy.pressure}`} />
        <DataCell label="Sell imbalance" value={`${(decision.microstructure.sell.imbalance * 100).toFixed(1)}% ${decision.microstructure.sell.pressure}`} />
      </div>
      <div>
        <div className="mb-2 text-xs uppercase text-zinc-500">Impact curve by simulated size</div>
        <div className="space-y-2">
          {decision.impactCurve.map((point) => (
            <div key={point.sizeBtc} className="grid grid-cols-[72px_1fr_92px] items-center gap-3 text-xs">
              <span className="text-zinc-400">{point.sizeBtc} BTC</span>
              <div className="h-3 rounded bg-zinc-800">
                <div
                  className={`h-3 rounded ${point.netProfitUsd >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
                  style={{
                    width: `${Math.max(4, Math.min(100, Math.abs(point.netProfitUsd) / Math.max(1, Math.abs(decision.netProfitUsd)) * 100))}%`,
                  }}
                />
              </div>
              <span className="text-right text-zinc-200">{money.format(point.netProfitUsd)}</span>
            </div>
          ))}
        </div>
      </div>
      <PnlWaterfallView steps={waterfall} />
      <DepthLensView lens={depthLens} />
      <LatencyRiskConeView cone={riskCone} />
      <MonteCarloView simulation={monteCarlo} />
      <KellySizingView sizing={kellySizing} />
      <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-xs leading-5 text-zinc-300">
        P(win) uses net edge divided by latency-adjusted sigma: notional × realized volatility × sqrt(latency).
        Monte Carlo samples adverse/favorable price shocks, then fractional Kelly converts that distribution into a capital allocation.
      </div>
    </div>
  );
}

function KellySizingView({ sizing }: { sizing: ReturnType<typeof deriveKellySizing> }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-zinc-500">Fractional Kelly sizing</div>
          <div className="mt-1 text-sm text-zinc-300">{sizing.reason}</div>
        </div>
        <Badge tone={sizing.decision === "skip" ? "red" : sizing.decision === "cap" ? "amber" : "green"}>
          {sizing.decision}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DataCell label="Mean return" value={`${sizing.meanReturnBps.toFixed(2)} bps`} />
        <DataCell label="Full Kelly" value={`${(sizing.fullKellyFraction * 100).toFixed(1)}%`} />
        <DataCell label="Allocated cap" value={`${(sizing.cappedFraction * 100).toFixed(1)}%`} />
        <DataCell label="VaR loss" value={money.format(sizing.maxLossAtVarUsd)} />
        <DataCell label="Recommended" value={money.format(sizing.recommendedNotionalUsd)} />
        <DataCell label="BTC size" value={`${btc.format(sizing.recommendedBtc)} BTC`} />
        <DataCell label="Current notional" value={money.format(sizing.notionalUsd)} />
        <DataCell label="Variance" value={sizing.varianceReturn.toExponential(2)} />
      </div>
    </div>
  );
}

function PnlWaterfallView({
  steps,
  compact = false,
}: {
  steps: ReturnType<typeof buildPnlWaterfall>;
  compact?: boolean;
}) {
  const min = Math.min(0, ...steps.map((step) => step.runningUsd));
  const max = Math.max(1, ...steps.map((step) => step.runningUsd));
  const range = Math.max(1, max - min);
  return (
    <div className={compact ? "space-y-2" : "rounded border border-zinc-800 bg-zinc-900 p-4"}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase text-zinc-500">P&L waterfall</div>
        {!compact && <div className="text-xs text-zinc-500">gross edge minus executable costs</div>}
      </div>
      <div className={`grid items-end gap-2 ${compact ? "h-28" : "h-40"} grid-cols-6`}>
        {steps.map((step) => {
          const height = Math.max(5, (Math.abs(step.valueUsd) / range) * 100);
          const offset = ((Math.min(step.runningUsd, step.runningUsd - step.valueUsd) - min) / range) * 100;
          const color =
            step.kind === "net"
              ? step.valueUsd >= 0
                ? "bg-cyan-300"
                : "bg-red-300"
              : step.kind === "gain"
                ? "bg-emerald-400"
                : "bg-amber-400";
          return (
            <div key={step.id} className="flex h-full min-w-0 flex-col justify-end gap-1">
              <div className="relative h-full rounded bg-zinc-950">
                <div
                  className={`absolute left-1 right-1 rounded ${color}`}
                  style={{
                    bottom: `${Math.max(0, Math.min(95, offset))}%`,
                    height: `${Math.min(100, height)}%`,
                  }}
                />
              </div>
              <div className="truncate text-center text-[10px] uppercase text-zinc-500">{step.label}</div>
              {!compact && (
                <div className="text-center text-xs font-medium text-zinc-200">{money.format(step.valueUsd)}</div>
              )}
            </div>
          );
        })}
      </div>
      {compact && (
        <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500">
          <span>Gross {money.format(steps[0]?.valueUsd ?? 0)}</span>
          <span className="text-center">Costs {money.format(steps.slice(1, -1).reduce((sum, step) => sum + step.valueUsd, 0))}</span>
          <span className="text-right">Net {money.format(steps[steps.length - 1]?.valueUsd ?? 0)}</span>
        </div>
      )}
    </div>
  );
}

function DepthLensView({
  lens,
  compact = false,
}: {
  lens: ReturnType<typeof buildExecutionDepthLens>;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2" : "rounded border border-zinc-800 bg-zinc-900 p-4"}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase text-zinc-500">Execution depth lens</div>
        {!compact && <div className="text-xs text-zinc-500">VWAP edge {lens.netVwapEdgeBps.toFixed(2)} bps</div>}
      </div>
      <div className={`grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        <DepthSideView side={lens.buy} compact={compact} />
        <DepthSideView side={lens.sell} compact={compact} />
      </div>
    </div>
  );
}

function DepthSideView({
  side,
  compact,
}: {
  side: ReturnType<typeof buildExecutionDepthLens>["buy"];
  compact: boolean;
}) {
  const maxBtc = Math.max(1e-9, ...side.levels.map((level) => level.cumulativeBtc));
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold capitalize text-zinc-100">
          {side.side} on {side.exchange}
        </div>
        <Badge tone={side.complete ? "green" : "amber"}>{side.levelsUsed} levels</Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
        <span>VWAP {money.format(side.vwap)}</span>
        <span className="text-right">Slippage {side.slippageBps.toFixed(2)} bps</span>
      </div>
      <div className="mt-3 space-y-2">
        {side.levels.slice(0, compact ? 3 : 6).map((level) => (
          <div key={`${side.side}-${level.index}`} className="grid grid-cols-[46px_1fr_88px] items-center gap-2 text-xs">
            <span className="text-zinc-500">L{level.index}</span>
            <div className="h-2 rounded bg-zinc-800">
              <div
                className={side.side === "buy" ? "h-2 rounded bg-amber-300" : "h-2 rounded bg-emerald-300"}
                style={{ width: `${Math.max(4, (level.cumulativeBtc / maxBtc) * 100)}%` }}
              />
            </div>
            <span className="text-right text-zinc-300">{btc.format(level.cumulativeBtc)} BTC</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonteCarloView({ simulation }: { simulation: ReturnType<typeof runMonteCarloExecution> }) {
  const maxCount = Math.max(1, ...simulation.histogram.map((bin) => bin.count));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase text-zinc-500">Monte Carlo execution distribution</div>
        <div className="text-xs text-zinc-500">
          {simulation.trials.toLocaleString("en-US")} trials · {simulation.horizonMs}ms horizon
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DataCell label="Mean P&L" value={money.format(simulation.meanPnlUsd)} />
        <DataCell label="Median P&L" value={money.format(simulation.medianPnlUsd)} />
        <DataCell label="Loss probability" value={`${(simulation.lossProbability * 100).toFixed(1)}%`} />
        <DataCell label="CVaR95" value={money.format(simulation.expectedShortfall95Usd)} />
      </div>
      <div className="mt-3 flex h-32 items-end gap-1 rounded border border-zinc-800 bg-zinc-900 p-3">
        {simulation.histogram.map((bin) => {
          const isLoss = bin.toUsd < 0;
          return (
            <div
              key={`${bin.fromUsd}-${bin.toUsd}`}
              title={`${money.format(bin.fromUsd)} to ${money.format(bin.toUsd)}: ${bin.count}`}
              className={`min-w-0 flex-1 rounded-t ${isLoss ? "bg-red-400" : "bg-emerald-400"}`}
              style={{ height: `${Math.max(4, (bin.count / maxCount) * 100)}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-500">
        <span>P05 {money.format(simulation.p05PnlUsd)}</span>
        <span className="text-center">P50 {money.format(simulation.medianPnlUsd)}</span>
        <span className="text-right">P95 {money.format(simulation.p95PnlUsd)}</span>
      </div>
    </div>
  );
}

function LatencyRiskConeView({ cone }: { cone: ReturnType<typeof buildLatencyRiskCone> }) {
  const worst = Math.min(...cone.points.flatMap((point) => [point.p05PnlUsd, point.p50PnlUsd]));
  const best = Math.max(...cone.points.flatMap((point) => [point.p50PnlUsd, point.p95PnlUsd]));
  const range = Math.max(1, best - worst);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase text-zinc-500">Latency risk cone</div>
        <div className="text-xs text-zinc-500">
          1s VaR95 {money.format(cone.valueAtRisk95Usd)} · ES95 {money.format(cone.expectedShortfall95Usd)}
        </div>
      </div>
      <div className="space-y-2">
        {cone.points.map((point) => {
          const left = ((point.p05PnlUsd - worst) / range) * 100;
          const width = Math.max(3, ((point.p95PnlUsd - point.p05PnlUsd) / range) * 100);
          const median = ((point.p50PnlUsd - point.p05PnlUsd) / Math.max(1, point.p95PnlUsd - point.p05PnlUsd)) * 100;
          return (
            <div key={point.latencyMs} className="grid grid-cols-[58px_1fr_58px] items-center gap-3 text-xs">
              <span className="text-zinc-400">{point.latencyMs}ms</span>
              <div className="relative h-4 rounded bg-zinc-800">
                <div
                  className="absolute top-1 h-2 rounded bg-cyan-500/70"
                  style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                >
                  <div className="absolute top-[-3px] h-4 w-0.5 bg-white" style={{ left: `${median}%` }} />
                </div>
              </div>
              <span className="text-right text-zinc-300">{(point.positiveProbability * 100).toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-zinc-500">
        {cone.breakEvenLatencyMs ? `Expected edge breaks near ${cone.breakEvenLatencyMs}ms.` : "Expected edge remains positive through the simulated latency range."}
      </div>
    </div>
  );
}

function HistoricalReplayView({ replay }: { replay?: HistoricalReplay }) {
  if (!replay) return <EmptyState text="Loading Kraken and Coinbase historical candles for replay." />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <DataCell label="Historical P&L" value={money.format(replay.summary.totalPnlUsd)} />
        <DataCell label="Win rate" value={`${(replay.summary.winRate * 100).toFixed(1)}%`} />
        <DataCell label="Trades" value={String(replay.summary.tradeCount)} />
        <DataCell label="Max drawdown" value={money.format(replay.summary.maxDrawdownUsd)} />
        <DataCell label="Aligned candles" value={String(replay.candles.aligned)} />
        <DataCell label="Average spread" value={`${replay.summary.averageSpreadBps.toFixed(2)} bps`} />
      </div>
      <EquityCurve points={replay.equityCurve} />
      {replay.errors.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Historical replay degraded gracefully: {replay.errors.length} source issue(s).
        </div>
      )}
      <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-xs leading-5 text-zinc-300">
        This replay aligns real one-minute OHLC candles from Kraken and Coinbase, then simulates
        cross-venue actions net of fees, slippage, and latency. It is not real trading and does not use keys.
      </div>
    </div>
  );
}

function HistoricalTradesView({ replay }: { replay?: HistoricalReplay }) {
  if (!replay) return <EmptyState text="Waiting for historical replay." />;
  if (replay.trades.length === 0) {
    return <EmptyState text="No historical spreads exceeded the configured net threshold in the fetched window." />;
  }
  return (
    <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
      {replay.trades.slice(-20).reverse().map((trade) => (
        <div key={`${trade.timestamp}-${trade.buyVenue}-${trade.sellVenue}`} className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold capitalize text-zinc-100">
              {trade.buyVenue} → {trade.sellVenue}
            </span>
            <Badge tone={trade.netProfitUsd >= 0 ? "green" : "red"}>{money.format(trade.netProfitUsd)}</Badge>
          </div>
          <div className="mt-2 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
            <span>{new Date(trade.timestamp).toLocaleTimeString()}</span>
            <span>Spread {trade.spreadBps.toFixed(2)} bps</span>
            <span>{btc.format(trade.sizeBtc)} BTC simulated</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">{trade.reason}</div>
        </div>
      ))}
    </div>
  );
}

function StrategyArena({ replay }: { replay?: HistoricalReplay }) {
  if (!replay) return <EmptyState text="Loading strategy comparison from historical candles." />;
  if (replay.strategies.length === 0) return <EmptyState text="No strategy runs are available for this replay window." />;
  const ranked = [...replay.strategies].sort((a, b) => b.summary.riskAdjustedScore - a.summary.riskAdjustedScore);
  return (
    <div className="grid gap-3 xl:grid-cols-3">
      {ranked.map((strategy, index) => (
        <StrategyCard key={strategy.id} strategy={strategy} rank={index + 1} />
      ))}
    </div>
  );
}

function OpportunityHeatmapView({ heatmap, compact = false }: { heatmap: OpportunityHeatmap; compact?: boolean }) {
  const maxDensity = Math.max(0.01, ...heatmap.cells.map((cell) => cell.opportunityDensity));
  const rows: OpportunityEdgeTier[] = ["elite", "strong", "tradable", "micro"];
  const hours = compact ? Array.from({ length: 12 }, (_, index) => index * 2) : Array.from({ length: 24 }, (_, index) => index);
  const tone =
    heatmap.summary.policy === "pattern-detected"
      ? "green"
      : heatmap.summary.policy === "opportunistic"
        ? "amber"
        : "neutral";
  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Historical pattern</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{heatmap.summary.policy}</div>
          </div>
          <Badge tone={tone}>{heatmap.summary.concentrationScore}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Opportunities" value={String(heatmap.summary.opportunityCount)} />
          <DataCell label="Hot hour" value={heatmap.summary.hotHourUtc !== undefined ? `${heatmap.summary.hotHourUtc}:00 UTC` : "none"} />
          <DataCell label="Hot tier" value={heatmap.summary.hotTier ?? "none"} />
          <DataCell label="Hot P&L" value={money.format(heatmap.summary.bestCellPnlUsd)} />
        </div>
        <div className="mt-4">
          <FormulaExplainer
            spec={{
              title: "Opportunity density equation",
              modelId: "opportunity-heatmap",
              equation: heatmap.equation,
              plainExplanation: "Aggregates replay trades by hour and edge tier so repeatable regimes stand out from one-off historical noise.",
            }}
          />
        </div>
        <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
          Converts real Kraken/Coinbase historical simulated trades into an hour-by-edge map so judges can see whether
          opportunities cluster into repeatable regimes or appear as one-off noise.
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px] rounded border border-zinc-800 bg-zinc-900 p-3">
          <div
            className="grid gap-1 text-xs"
            style={{ gridTemplateColumns: `76px repeat(${hours.length}, minmax(${compact ? 42 : 30}px, 1fr))` }}
          >
            <div className="text-zinc-500">tier / UTC</div>
            {hours.map((hour) => (
              <div key={hour} className="text-center text-[10px] text-zinc-500">
                {hour}
              </div>
            ))}
            {rows.map((tier) => (
              <OpportunityHeatmapRow key={tier} tier={tier} hours={hours} cells={heatmap.cells} maxDensity={maxDensity} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OpportunityHeatmapRow({
  tier,
  hours,
  cells,
  maxDensity,
}: {
  tier: OpportunityEdgeTier;
  hours: number[];
  cells: OpportunityHeatmapCell[];
  maxDensity: number;
}) {
  return (
    <>
      <div className="flex items-center capitalize text-zinc-500">{tier}</div>
      {hours.map((hour) => {
        const relevant = cells.filter((cell) => cell.edgeTier === tier && (hours.length === 12 ? cell.hourUtc === hour || cell.hourUtc === hour + 1 : cell.hourUtc === hour));
        const tradeCount = relevant.reduce((sum, cell) => sum + cell.tradeCount, 0);
        const totalPnlUsd = relevant.reduce((sum, cell) => sum + cell.totalPnlUsd, 0);
        const density = relevant.reduce((sum, cell) => sum + cell.opportunityDensity, 0);
        const intensity = Math.max(0.08, Math.min(1, density / maxDensity));
        return (
          <div
            key={`${tier}-${hour}`}
            className="min-h-12 rounded border border-zinc-800 p-1 text-center"
            style={{ backgroundColor: `rgba(16, 185, 129, ${intensity * 0.55})` }}
            title={`${tier} ${hour}:00 UTC · ${tradeCount} trades · ${money.format(totalPnlUsd)}`}
          >
            <div className="text-xs font-semibold text-zinc-100">{tradeCount || ""}</div>
            <div className="mt-1 text-[10px] text-zinc-300">{totalPnlUsd ? money.format(totalPnlUsd) : ""}</div>
          </div>
        );
      })}
    </>
  );
}

function WalkForwardRobustnessView({ lab, compact = false }: { lab: WalkForwardRobustness; compact?: boolean }) {
  const tone =
    lab.summary.policy === "deploy"
      ? "green"
      : lab.summary.policy === "cap-size"
        ? "amber"
        : lab.summary.policy === "reject-overfit"
          ? "red"
          : "neutral";
  const maxScore = Math.max(1, ...lab.candidates.map((candidate) => Math.max(candidate.trainScore, candidate.testScore)));

  if (lab.summary.policy === "insufficient-history") {
    return (
      <EmptyState
        text="Need more historical simulated trades to run a walk-forward train/test validation."
        source="/api/historical-replay"
        prerequisite="more replay trades"
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Out-of-sample policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{lab.summary.policy}</div>
          </div>
          <Badge tone={tone}>{lab.summary.testScore}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Selected filter" value={`${lab.summary.selectedMinSpreadBps} bps`} />
          <DataCell label="Generalization" value={`${(lab.summary.generalizationRatio * 100).toFixed(1)}%`} />
          <DataCell label="OOS P&L" value={money.format(lab.summary.outOfSamplePnlUsd)} />
          <DataCell label="OOS win rate" value={`${(lab.summary.outOfSampleWinRate * 100).toFixed(1)}%`} />
          <DataCell label="Train trades" value={String(lab.trainWindow.tradeCount)} />
          <DataCell label="Test trades" value={String(lab.testWindow.tradeCount)} />
        </div>
        <div className="mt-4">
          <FormulaExplainer
            spec={{
              title: "Walk-forward robustness equation",
              modelId: "walk-forward-robustness",
              equation: lab.equation,
              plainExplanation: "Compares in-sample training performance with frozen out-of-sample results to expose overfit spread filters.",
            }}
          />
        </div>
        {!compact && (
          <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            Trains spread filters on the first historical segment, then freezes the chosen threshold and evaluates
            the later segment out of sample. This is the anti-overfit proof for the historical strategy.
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Train vs out-of-sample scores</div>
              <div className="text-xs text-zinc-500">candidate spread filters ranked by in-sample score</div>
            </div>
            <Badge tone={lab.summary.overfitPenalty > 50 ? "red" : lab.summary.overfitPenalty > 25 ? "amber" : "green"}>
              overfit penalty {lab.summary.overfitPenalty}/100
            </Badge>
          </div>
          <div className="space-y-2">
            {lab.candidates.slice(0, compact ? 4 : 8).map((candidate) => (
              <div key={candidate.minSpreadBps} className="grid grid-cols-[66px_1fr_62px] items-center gap-3 text-xs">
                <span className="text-zinc-400">{candidate.minSpreadBps} bps</span>
                <div className="space-y-1">
                  <div className="h-2 rounded bg-zinc-800">
                    <div className="h-2 rounded bg-cyan-400" style={{ width: `${(candidate.trainScore / maxScore) * 100}%` }} />
                  </div>
                  <div className="h-2 rounded bg-zinc-800">
                    <div
                      className={`h-2 rounded ${candidate.testPnlUsd >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
                      style={{ width: `${(candidate.testScore / maxScore) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-right text-zinc-300">{money.format(candidate.testPnlUsd)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-500">
            <span>cyan = train</span>
            <span className="text-center">green/red = test</span>
            <span className="text-right">right = OOS P&L</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {lab.reasons.map((reason) => (
            <Badge key={reason} tone={reason.includes("failure") || reason.includes("overfit") ? "red" : reason.includes("capped") ? "amber" : "green"}>
              {reason}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function BayesianRegimeBreakView({ lab, compact = false }: { lab: BayesianRegimeBreakLab; compact?: boolean }) {
  const tone =
    lab.summary.policy === "trust-history"
      ? "green"
      : lab.summary.policy === "cap-size"
        ? "amber"
        : lab.summary.policy === "retrain"
          ? "red"
          : "neutral";
  const visible = compact ? lab.observations.slice(-18) : lab.observations.slice(-36);
  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Historical regime policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{lab.summary.policy}</div>
          </div>
          <Badge tone={tone}>{lab.summary.posteriorTrustScore}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Break posterior" value={`${(lab.summary.latestBreakProbability * 100).toFixed(1)}%`} />
          <DataCell label="Run length" value={String(lab.summary.latestRunLength)} />
          <DataCell label="Regime shift" value={`${lab.summary.regimeShiftBps.toFixed(2)} bps`} />
          <DataCell label="Edge decay" value={`${lab.summary.expectedEdgeDecayBps.toFixed(2)} bps`} />
          <DataCell label="Hazard" value={`${(lab.summary.hazardRate * 100).toFixed(1)}%`} />
          <DataCell label="Samples" value={String(lab.summary.sampleCount)} />
        </div>
        <div className="mt-4">
          <FormulaExplainer
            spec={{
              title: "Regime break equation",
              modelId: "bayesian-regime-break",
              equation: lab.equation,
              plainExplanation: "Estimates whether the spread process has shifted enough that historical replay evidence should be capped or retrained.",
            }}
          />
        </div>
        {!compact && (
          <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            This is a causal change-point guard for historical evidence: if the spread distribution shifts, ArbX-Ray caps
            or retrains instead of trusting a backtest from the old regime.
          </div>
        )}
      </div>
      <div className="space-y-4">
        <RegimeBreakSparkline observations={visible} changepoints={lab.changepoints} />
        <div className="grid gap-2 md:grid-cols-2">
          {lab.changepoints.slice(0, compact ? 2 : 4).map((point) => (
            <div key={`${point.timestamp}-${point.index}`} className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-100">{new Date(point.timestamp).toLocaleTimeString()}</div>
                <Badge tone={point.shiftBps < 0 ? "red" : "amber"}>{(point.probability * 100).toFixed(1)}%</Badge>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-400">
                <span>before {point.beforeMeanBps.toFixed(2)}</span>
                <span>after {point.afterMeanBps.toFixed(2)}</span>
                <span>shift {point.shiftBps.toFixed(2)} bps</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {lab.reasons.map((reason) => (
            <Badge key={reason} tone={lab.summary.policy === "retrain" ? "red" : lab.summary.policy === "cap-size" ? "amber" : "green"}>
              {reason}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function RegimeBreakSparkline({
  observations,
  changepoints,
}: {
  observations: RegimeBreakObservation[];
  changepoints: BayesianRegimeBreakLab["changepoints"];
}) {
  if (observations.length === 0) {
    return (
      <EmptyState
        text="No regime observations available yet."
        source="/api/historical-replay"
        prerequisite="accepted replay observations"
      />
    );
  }
  const spreadMin = Math.min(...observations.map((item) => item.spreadBps), 0);
  const spreadMax = Math.max(...observations.map((item) => item.spreadBps), 1);
  const range = Math.max(1, spreadMax - spreadMin);
  const breakSet = new Set(changepoints.map((point) => point.index));
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Online change posterior</div>
          <div className="text-xs text-zinc-500">bars = spread bps, line = P(change)</div>
        </div>
        <Badge tone="cyan">Bayesian run length</Badge>
      </div>
      <div className="flex h-36 items-end gap-1 border-b border-zinc-800 pb-2">
        {observations.map((item) => {
          const height = Math.max(4, ((item.spreadBps - spreadMin) / range) * 88);
          const posteriorHeight = Math.max(3, item.breakProbability * 100);
          return (
            <div key={`${item.timestamp}-${item.index}`} className="relative min-w-0 flex-1">
              <div
                className={`mx-auto w-full rounded-t ${breakSet.has(item.index) ? "bg-red-400" : item.spreadBps >= 0 ? "bg-emerald-400" : "bg-red-500/70"}`}
                style={{ height: `${height}%` }}
                title={`spread ${item.spreadBps.toFixed(2)} bps · P(change) ${(item.breakProbability * 100).toFixed(1)}%`}
              />
              <div
                className="absolute bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-cyan-200"
                style={{ height: `${posteriorHeight}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-500">
        <span>min {spreadMin.toFixed(2)} bps</span>
        <span className="text-center">latest {observations[observations.length - 1]?.spreadBps.toFixed(2)} bps</span>
        <span className="text-right">max {spreadMax.toFixed(2)} bps</span>
      </div>
    </div>
  );
}

function ConformalExecutionGuardView({
  guard,
  compact = false,
}: {
  guard: ConformalExecutionGuard;
  compact?: boolean;
}) {
  const tone =
    guard.summary.policy === "execute"
      ? "green"
      : guard.summary.policy === "cap-size"
        ? "amber"
        : guard.summary.policy === "wait"
          ? "red"
          : "neutral";
  const visible = compact ? guard.calibration.slice(-16) : guard.calibration.slice(-32);

  if (guard.summary.policy === "insufficient-history") {
    return <EmptyState text="Load historical replay to calibrate split-conformal execution residuals." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Finite-sample policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{guard.summary.policy}</div>
          </div>
          <Badge tone={tone}>{guard.summary.coverageScore}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Coverage target" value={`${(guard.summary.targetCoverage * 100).toFixed(0)}%`} />
          <DataCell label="Samples" value={String(guard.summary.sampleCount)} />
          <DataCell label="Expected net" value={money.format(guard.summary.expectedNetUsd)} />
          <DataCell label="Lower bound" value={money.format(guard.summary.lowerBoundUsd)} />
          <DataCell label="Residual q" value={money.format(guard.summary.quantileResidualUsd)} />
          <DataCell label="Rec. size" value={`${btc.format(guard.summary.recommendedSizeBtc)} BTC`} />
        </div>
        <div className="mt-4">
          <FormulaExplainer
            spec={{
              title: "Conformal guard equation",
              modelId: "conformal-execution-guard",
              equation: guard.equation,
              plainExplanation: "Subtracts a calibrated residual from expected net profit so the simulated route survives finite-sample downside uncertainty.",
            }}
          />
        </div>
        {!compact && (
          <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            Split conformal prediction turns historical simulator misses into a distribution-free downside buffer. The
            live route must remain profitable after subtracting the calibrated residual, or size is capped before the
            simulated action is trusted.
          </div>
        )}
      </div>
      <div className="space-y-4">
        <ConformalResidualChart points={visible} quantileResidualUsd={guard.summary.quantileResidualUsd} />
        <div className="grid gap-2 md:grid-cols-2">
          {guard.calibration.slice(-(compact ? 2 : 4)).map((point) => (
            <div key={`${point.timestamp}-${point.route}`} className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-100">{point.route}</div>
                <Badge tone={point.residualUsd > guard.summary.quantileResidualUsd * 0.7 ? "amber" : "green"}>
                  {money.format(point.residualUsd)}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-400">
                <span>net {money.format(point.netProfitUsd)}</span>
                <span>median {money.format(point.rollingMedianUsd)}</span>
                <span>spread {point.spreadBps.toFixed(1)} bps</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {guard.reasons.map((reason) => (
            <Badge key={reason} tone={tone}>
              {reason}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConformalResidualChart({
  points,
  quantileResidualUsd,
}: {
  points: ConformalCalibrationPoint[];
  quantileResidualUsd: number;
}) {
  if (points.length === 0) {
    return (
      <EmptyState
        text="No conformal calibration points available yet."
        source="/api/historical-replay"
        prerequisite="calibration residuals"
      />
    );
  }
  const maxResidual = Math.max(1, quantileResidualUsd, ...points.map((point) => point.residualUsd));
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Calibration residuals</div>
          <div className="text-xs text-zinc-500">bars = downside residual, line = conformal quantile</div>
        </div>
        <Badge tone="cyan">q {money.format(quantileResidualUsd)}</Badge>
      </div>
      <div className="relative flex h-36 items-end gap-1 border-b border-zinc-800 pb-2">
        <div
          className="absolute left-0 right-0 border-t border-dashed border-cyan-300/70"
          style={{ bottom: `${Math.min(96, (quantileResidualUsd / maxResidual) * 100)}%` }}
        />
        {points.map((point) => {
          const height = Math.max(4, (point.residualUsd / maxResidual) * 96);
          return (
            <div key={`${point.timestamp}-${point.route}`} className="relative min-w-0 flex-1">
              <div
                className={`mx-auto w-full rounded-t ${point.residualUsd >= quantileResidualUsd ? "bg-amber-300" : "bg-emerald-400"}`}
                style={{ height: `${height}%` }}
                title={`${point.route}: residual ${money.format(point.residualUsd)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-500">
        <span>0 residual</span>
        <span className="text-center">tail hits marked amber</span>
        <span className="text-right">max {money.format(maxResidual)}</span>
      </div>
    </div>
  );
}

function ExecutionTournamentView({
  tournament,
  compact = false,
}: {
  tournament: ExecutionTournament;
  compact?: boolean;
}) {
  if (tournament.summary.policy === "insufficient-history") {
    return <EmptyState text="Load historical replay to run the policy tournament and regret comparison." />;
  }
  const championTone =
    tournament.summary.policy === "ship-autopilot"
      ? "green"
      : tournament.summary.policy === "cap-and-monitor"
        ? "amber"
        : "red";
  const maxScore = Math.max(1, ...tournament.contestants.map((contestant) => contestant.score));
  const arbx = tournament.contestants.find((contestant) => contestant.id === "arbx-ray-autopilot");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase text-zinc-500">Tournament policy</div>
              <div className="mt-1 text-4xl font-semibold uppercase text-white">{tournament.summary.policy}</div>
            </div>
            <Badge tone={championTone}>rank #{tournament.summary.arbxRank || "n/a"}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <DataCell label="Champion" value={tournament.summary.championLabel ?? "none"} />
            <DataCell label="Best P&L" value={money.format(tournament.summary.bestPnlUsd)} />
            <DataCell label="ArbX regret" value={money.format(tournament.summary.arbxRegretUsd)} />
            <DataCell label="Exploitability" value={`${tournament.summary.exploitabilityScore}/100`} />
          </div>
          <div className="mt-4">
            <FormulaExplainer
              spec={{
                title: "Policy tournament equation",
                modelId: "execution-tournament",
                equation: tournament.equation,
                plainExplanation: "Ranks competing execution policies by realized replay P&L, regret, drawdown, and exploitability.",
              }}
            />
          </div>
          <div className="mt-3 space-y-2">
            {tournament.reasons.map((reason) => (
              <div key={reason} className="rounded border border-zinc-800 bg-zinc-950 p-2 text-xs leading-5 text-zinc-300">
                {reason}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Policy leaderboard</div>
              <div className="text-xs text-zinc-500">same historical replay, different simulated decision rules</div>
            </div>
            <Badge tone={arbx?.action === "deploy" ? "green" : arbx?.action === "cap-size" ? "amber" : "red"}>
              autopilot {arbx?.action ?? "loading"}
            </Badge>
          </div>
          <div className="space-y-2">
            {tournament.contestants.slice(0, compact ? 5 : 6).map((contestant, index) => (
              <TournamentContestantRow
                key={contestant.id}
                contestant={contestant}
                rank={index + 1}
                maxScore={maxScore}
              />
            ))}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="grid gap-3 md:grid-cols-3">
          {tournament.contestants.slice(0, 3).map((contestant) => (
            <div key={contestant.id} className="rounded border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">{contestant.label}</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">{contestant.thesis}</div>
                </div>
                <Badge tone={contestant.action === "deploy" ? "green" : contestant.action === "cap-size" ? "amber" : "red"}>
                  {contestant.action}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <DataCell label="P&L" value={money.format(contestant.totalPnlUsd)} />
                <DataCell label="Regret" value={money.format(contestant.regretUsd)} />
                <DataCell label="Win rate" value={`${(contestant.winRate * 100).toFixed(1)}%`} />
                <DataCell label="Drawdown" value={money.format(contestant.maxDrawdownUsd)} />
              </div>
              <div className="mt-3 space-y-1">
                {contestant.evidence.map((item) => (
                  <div key={item} className="text-xs leading-5 text-zinc-500">{item}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentContestantRow({
  contestant,
  rank,
  maxScore,
}: {
  contestant: ExecutionTournamentContestant;
  rank: number;
  maxScore: number;
}) {
  const tone = contestant.id === "arbx-ray-autopilot" ? "cyan" : contestant.action === "deploy" ? "green" : contestant.action === "cap-size" ? "amber" : "red";
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">
            #{rank} {contestant.label}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {money.format(contestant.totalPnlUsd)} P&L · regret {money.format(contestant.regretUsd)} · {contestant.tradeCount} trades
          </div>
        </div>
        <Badge tone={tone}>{contestant.score}/100</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[0.62fr_0.38fr]">
        <div className="h-2 rounded bg-zinc-800">
          <div className="h-2 rounded bg-cyan-300" style={{ width: `${clampForStyle((contestant.score / maxScore) * 100, 2, 100)}%` }} />
        </div>
        <div className="h-2 rounded bg-zinc-800">
          <div
            className={`h-2 rounded ${contestant.exploitabilityScore <= 10 ? "bg-emerald-400" : contestant.exploitabilityScore <= 30 ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${clampForStyle(100 - contestant.exploitabilityScore, 2, 100)}%` }}
          />
        </div>
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>score</span>
        <span>exploitability {contestant.exploitabilityScore}/100</span>
      </div>
    </div>
  );
}

function SensitivitySurfaceView({ replay }: { replay?: HistoricalReplay }) {
  if (!replay) return <EmptyState text="Loading sensitivity surface from historical replay." />;
  const surface = replay.sensitivity;
  const maxScore = Math.max(1, ...surface.cells.map((cell) => cell.riskAdjustedScore));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <DataCell label="Best score" value={`${surface.bestCell?.riskAdjustedScore ?? 0}/100`} />
        <DataCell label="Best spread filter" value={`${surface.bestCell?.minSpreadBps ?? 0} bps`} />
        <DataCell label="Best cost load" value={`${surface.bestCell?.costBps ?? 0} bps`} />
        <DataCell label="Best P&L" value={money.format(surface.bestCell?.totalPnlUsd ?? 0)} />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[680px] rounded border border-zinc-800 bg-zinc-900 p-3">
          <div
            className="grid gap-2 text-xs"
            style={{ gridTemplateColumns: `92px repeat(${surface.costBpsValues.length}, minmax(86px, 1fr))` }}
          >
            <div className="text-zinc-500">spread / cost</div>
            {surface.costBpsValues.map((cost) => (
              <div key={cost} className="text-center text-zinc-500">{cost} bps</div>
            ))}
            {surface.minSpreadBpsValues.map((spread) => (
              <SensitivityRow key={spread} spread={spread} surface={surface} maxScore={maxScore} />
            ))}
          </div>
        </div>
      </div>
      <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-xs leading-5 text-zinc-300">
        Each cell reruns the same real Kraken/Coinbase candle window with a different spread filter and cost load.
        The surface shows whether a strategy is robust or only works under one fragile assumption.
      </div>
    </div>
  );
}

function StatArbSignalView({ replay }: { replay?: HistoricalReplay }) {
  if (!replay) return <EmptyState text="Loading statistical arbitrage signal." />;
  const signal = replay.statArb;
  const maxAbsCorr = Math.max(0.01, ...signal.leadLag.map((point) => Math.abs(point.correlation)));
  return (
    <div className="grid gap-4 xl:grid-cols-[0.45fr_0.55fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <DataCell label="Regime" value={signal.regime} />
          <DataCell label="Samples" value={String(signal.sampleCount)} />
          <DataCell label="Return corr" value={signal.returnCorrelation.toFixed(3)} />
          <DataCell label="Latest z-score" value={signal.latestZScore.toFixed(2)} />
          <DataCell label="Spread mean" value={`${signal.spreadMeanBps.toFixed(2)} bps`} />
          <DataCell label="Half-life" value={signal.halfLifeMinutes !== undefined ? `${signal.halfLifeMinutes.toFixed(1)}m` : "unresolved"} />
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-xs leading-5 text-zinc-300">
          {signal.thesis}
        </div>
      </div>
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs uppercase text-zinc-500">Lead / lag correlation</div>
          <div className="text-xs text-zinc-500">
            best {signal.bestLeadLag.lagMinutes}m · {signal.bestLeadLag.correlation.toFixed(3)}
          </div>
        </div>
        <div className="flex h-36 items-end gap-2">
          {signal.leadLag.map((point) => (
            <div key={point.lagMinutes} className="flex h-full flex-1 flex-col justify-end gap-2">
              <div className="relative h-full rounded bg-zinc-950">
                <div
                  className={point.correlation >= 0 ? "absolute bottom-1 left-1 right-1 rounded bg-emerald-300" : "absolute bottom-1 left-1 right-1 rounded bg-red-300"}
                  style={{ height: `${Math.max(4, (Math.abs(point.correlation) / maxAbsCorr) * 100)}%` }}
                />
              </div>
              <div className="text-center text-[10px] text-zinc-500">{point.lagMinutes}m</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SensitivityRow({
  spread,
  surface,
  maxScore,
}: {
  spread: number;
  surface: HistoricalReplay["sensitivity"];
  maxScore: number;
}) {
  return (
    <>
      <div className="flex items-center text-zinc-500">{spread} bps</div>
      {surface.costBpsValues.map((cost) => {
        const cell = surface.cells.find((item) => item.minSpreadBps === spread && item.costBps === cost);
        const score = cell?.riskAdjustedScore ?? 0;
        const intensity = Math.max(0.12, score / maxScore);
        return (
          <div
            key={`${spread}-${cost}`}
            className="rounded border border-zinc-800 p-2 text-center"
            style={{ backgroundColor: `rgba(34, 211, 238, ${intensity * 0.45})` }}
            title={`${money.format(cell?.totalPnlUsd ?? 0)} · ${cell?.tradeCount ?? 0} trades`}
          >
            <div className="font-semibold text-zinc-100">{score}</div>
            <div className="mt-1 text-[10px] text-zinc-400">{cell?.tradeCount ?? 0} trades</div>
          </div>
        );
      })}
    </>
  );
}

function StrategyCard({ strategy, rank }: { strategy: HistoricalStrategyRun; rank: number }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-zinc-500">Rank {rank}</div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">{strategy.label}</div>
        </div>
        <Badge tone={rank === 1 ? "green" : "neutral"}>{strategy.summary.riskAdjustedScore}/100</Badge>
      </div>
      <p className="mt-3 min-h-12 text-xs leading-5 text-zinc-400">{strategy.thesis}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DataCell label="P&L" value={money.format(strategy.summary.totalPnlUsd)} />
        <DataCell label="Trades" value={String(strategy.summary.tradeCount)} />
        <DataCell label="Win rate" value={`${(strategy.summary.winRate * 100).toFixed(0)}%`} />
        <DataCell label="Trades/hr" value={strategy.summary.tradesPerHour.toFixed(2)} />
        <DataCell label="Drawdown" value={money.format(strategy.summary.maxDrawdownUsd)} />
        <DataCell label="Profit factor" value={strategy.summary.profitFactor.toFixed(2)} />
      </div>
      <div className="mt-3">
        <MiniEquityCurve points={strategy.equityCurve} />
      </div>
      <div className="mt-3 rounded border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-400">
        size {strategy.config.sizeBtc} BTC · min spread {strategy.config.minSpreadBps} bps · costs{" "}
        {strategy.config.feeBps + strategy.config.slippageBps + strategy.config.latencyBps} bps + envelope{" "}
        {strategy.config.envelopeUncertaintyBps} bps
      </div>
    </div>
  );
}

function EquityCurve({ points }: { points: { timestamp: number; cumulativePnlUsd: number }[] }) {
  const values = useMemo(() => points.map((point) => point.cumulativePnlUsd), [points]);
  const summary = useMemo(() => summarizeChartSeries(values), [values]);
  const path = useMemo(() => {
    if (values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    return points
      .map((point, index) => {
        const x = (index / Math.max(1, points.length - 1)) * 100;
        const y = 100 - ((point.cumulativePnlUsd - min) / range) * 100;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points, values]);

  if (points.length === 0) return <EmptyState text="Equity curve appears when replay finds historical opportunities." />;
  return (
    <ChartFrame
      title="Historical equity curve"
      source="Kraken/Coinbase replay"
      description="Cumulative simulated P&L generated by the historical replay strategy."
      metrics={[
        { label: "Marks", value: String(summary.count), tone: "neutral" },
        { label: "Last", value: money.format(summary.last), tone: summary.last >= 0 ? "green" : "red" },
        { label: "Delta", value: money.format(summary.delta), tone: summary.delta >= 0 ? "green" : "red" },
      ]}
    >
      <AccessibleChartSvg
        title="Historical equity curve"
        description="Cumulative simulated P&L generated by the historical replay strategy."
        className="h-52"
      >
        {points.length === 1 ? (
          <>
            <line x1="0" y1="50" x2="100" y2="50" stroke="rgb(34 211 238)" strokeWidth="2.5" />
            <circle cx="100" cy="50" r="2.8" fill="rgb(34 211 238)" />
          </>
        ) : (
          <path d={path} fill="none" stroke="rgb(34 211 238)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        )}
        <line x1="0" y1="100" x2="100" y2="100" stroke="rgb(63 63 70)" strokeWidth="1" />
      </AccessibleChartSvg>
    </ChartFrame>
  );
}

function MiniEquityCurve({ points }: { points: { timestamp: number; cumulativePnlUsd: number }[] }) {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const values = points.map((point) => point.cumulativePnlUsd);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    return points
      .map((point, index) => {
        const x = (index / Math.max(1, points.length - 1)) * 100;
        const y = 100 - ((point.cumulativePnlUsd - min) / range) * 100;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded border border-dashed border-zinc-800 text-xs text-zinc-500">
        no fills
      </div>
    );
  }
  return (
    <AccessibleChartSvg
      title="Strategy mini equity curve"
      description="Compressed cumulative P&L sparkline for this replay strategy."
      viewBox="0 0 100 40"
      className="h-20 rounded border border-zinc-800 bg-zinc-950 p-2"
    >
      {points.length === 1 ? (
        <>
          <line x1="0" y1="20" x2="100" y2="20" stroke="rgb(52 211 153)" strokeWidth="2" />
          <circle cx="100" cy="20" r="2.5" fill="rgb(52 211 153)" />
        </>
      ) : (
        <path d={path} fill="none" stroke="rgb(52 211 153)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      )}
      <line x1="0" y1="39" x2="100" y2="39" stroke="rgb(63 63 70)" strokeWidth="1" />
    </AccessibleChartSvg>
  );
}

function DemoDirectorView({
  evidence,
  onNavigate,
}: {
  evidence: ChallengeEvidence;
  onNavigate: (view: DashboardView) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Readiness</div>
            <div className="mt-1 text-5xl font-semibold text-white">{evidence.readinessScore}</div>
          </div>
          <Badge
            tone={
              evidence.verdict === "national-final-ready"
                ? "green"
                : evidence.verdict === "demo-ready"
                  ? "cyan"
                  : "amber"
            }
          >
            {evidence.verdict}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Public sources" value={String(evidence.sourceCount)} />
          <DataCell label="Demo steps" value={`${evidence.demoSteps.length}`} />
        </div>
        <div className="mt-4 space-y-2">
          {evidence.gaps.length === 0 ? (
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-100">
              The current demo path has evidence for every challenge criterion.
            </div>
          ) : (
            evidence.gaps.map((gap) => (
              <div key={gap} className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                {gap}
              </div>
            ))
          )}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {evidence.demoSteps.map((step, index) => (
          <div key={step.id} className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase text-zinc-500">Step {index + 1} · {step.timeboxSeconds}s</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{step.label}</div>
              </div>
              <Button onClick={() => onNavigate(step.view)}>
                <Activity size={14} /> Open
              </Button>
            </div>
            <div className="mt-3 rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-cyan-100">
              {step.kpi}
            </div>
            <div className="mt-2 text-xs leading-5 text-zinc-400">{step.proof}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceNavigatorView({
  navigator,
  onNavigate,
}: {
  navigator: EvidenceNavigator;
  onNavigate: (view: DashboardView) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Proof coverage</div>
            <div className="mt-1 text-5xl font-semibold text-white">{navigator.summary.coveragePct}%</div>
          </div>
          <Badge tone={navigator.summary.coveragePct >= 90 ? "green" : navigator.summary.coveragePct >= 70 ? "cyan" : "amber"}>
            {navigator.summary.highImpactTimeSeconds}s route
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Total steps" value={String(navigator.summary.totalSteps)} />
          <DataCell label="Full demo" value={`${navigator.summary.totalTimeSeconds}s`} />
          <DataCell label="Strongest view" value={navigator.summary.strongestView} />
          <DataCell label="Route steps" value={String(navigator.highImpactRoute.length)} />
        </div>
        <div className="mt-4 space-y-2">
          {navigator.coverage.map((item) => (
            <div key={item.criterionId} className="grid grid-cols-[1fr_52px] items-center gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-zinc-200">{item.label}</span>
                  <span className="text-zinc-500">{item.score}/100</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-zinc-800">
                  <div
                    className={`h-1.5 rounded ${item.covered ? "bg-emerald-400" : item.status === "gap" ? "bg-red-400" : "bg-amber-400"}`}
                    style={{ width: `${Math.max(4, item.score)}%` }}
                  />
                </div>
              </div>
              <Badge tone={item.covered ? "green" : item.status === "gap" ? "red" : "amber"}>
                {item.covered ? "covered" : item.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">High-impact route</div>
              <div className="text-xs text-zinc-500">compressed path selected from all proof panels</div>
            </div>
            <Badge tone="cyan">{navigator.summary.highImpactTimeSeconds}s</Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {navigator.highImpactRoute.map((item, index) => (
              <EvidenceRouteCard key={item.step.id} item={item} index={index} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-100">View load</div>
            <div className="space-y-2">
              {navigator.byView.map((group) => (
                <button
                  key={group.view}
                  onClick={() => onNavigate(group.view)}
                  className="grid w-full grid-cols-[82px_1fr_48px] items-center gap-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs hover:bg-zinc-900"
                >
                  <span className="capitalize text-zinc-200">{group.view}</span>
                  <span className="truncate text-zinc-500">{group.strongestKpi}</span>
                  <span className="text-right text-cyan-100">{group.stepCount}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-100">Navigation gaps</div>
            <div className="flex flex-wrap gap-2">
              {navigator.navigationGaps.length ? (
                navigator.navigationGaps.map((gap) => (
                  <Badge key={gap} tone="amber">
                    {gap}
                  </Badge>
                ))
              ) : (
                <Badge tone="green">all criteria covered</Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceRouteCard({
  item,
  index,
  onNavigate,
}: {
  item: EvidenceRouteItem;
  index: number;
  onNavigate: (view: DashboardView) => void;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-zinc-500">
            #{index + 1} · {item.step.view} · {item.step.timeboxSeconds}s
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">{item.step.label}</div>
        </div>
        <Button onClick={() => onNavigate(item.step.view)}>
          <Activity size={14} /> Open
        </Button>
      </div>
      <div className="mt-3 rounded border border-zinc-800 bg-zinc-900 p-2 text-xs text-cyan-100">{item.step.kpi}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {item.criteria.map((criterion) => (
          <Badge key={criterion} tone="neutral">
            {criterion}
          </Badge>
        ))}
        <Badge tone="cyan">impact {item.impactScore}</Badge>
      </div>
    </div>
  );
}

function DecisionAuditReceiptView({ evidence }: { evidence: ChallengeEvidence }) {
  const receipt = evidence.decisionReceipt;
  if (!receipt) {
    return <EmptyState text="Start replay or live feeds to generate a reproducible decision receipt." />;
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase text-zinc-500">Audit fingerprint</div>
            <div className="mt-1 break-all font-mono text-lg font-semibold text-white">{receipt.fingerprint}</div>
          </div>
          <Badge tone={receipt.status === "accepted" ? "green" : "red"}>{receipt.status}</Badge>
        </div>
        <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
          {receipt.route}
        </div>
        <div className="mt-4 grid gap-2">
          {receipt.policyRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
              <span className="text-zinc-500">{row.label}</span>
              <span className="text-right text-zinc-200">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="grid gap-2 md:grid-cols-2">
          {receipt.formulaRows.map((row) => (
            <DataCell key={row.label} label={row.label} value={formatReceiptValue(row.value, row.unit)} />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs uppercase text-zinc-500">Provenance chain</div>
            <div className="mt-3 space-y-2">
              {receipt.provenance.map((item) => (
                <div key={item} className="rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs uppercase text-zinc-500">Execution decision</div>
            <div className="mt-3 space-y-2">
              {receipt.rejectionReasons.length > 0 ? (
                receipt.rejectionReasons.map((reason) => (
                  <div key={reason} className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-100">
                    {reason}
                  </div>
                ))
              ) : (
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-100">
                  Accepted by net P&L, depth, latency, inventory, and governor checks.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function JudgeScorecardView({ scorecard }: { scorecard: ReturnType<typeof buildJudgeScorecard> }) {
  const scores = [
    { label: "Speed", value: scorecard.speed },
    { label: "Precision", value: scorecard.precision },
    { label: "Robustness", value: scorecard.robustness },
    { label: "Strategy", value: scorecard.strategy },
    { label: "Presentation", value: scorecard.presentation },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 rounded border border-zinc-800 bg-zinc-900 p-4">
        <div>
          <div className="text-xs uppercase text-zinc-500">Overall readiness</div>
          <div className="mt-1 text-5xl font-semibold text-white">{scorecard.overall}</div>
        </div>
        <Badge tone={scorecard.overall >= 85 ? "green" : "amber"}>judge-ready</Badge>
      </div>
      <div className="space-y-3">
        {scores.map((score) => (
          <div key={score.label} className="grid grid-cols-[105px_1fr_42px] items-center gap-3 text-sm">
            <span className="text-zinc-400">{score.label}</span>
            <div className="h-2 rounded bg-zinc-800">
              <div className="h-2 rounded bg-cyan-300" style={{ width: `${score.value}%` }} />
            </div>
            <span className="text-right font-semibold text-zinc-100">{score.value}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {scorecard.bullets.map((bullet) => (
          <div key={bullet} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
            {bullet}
          </div>
        ))}
      </div>
    </div>
  );
}

function StressLab({
  decision,
  stressResults,
}: {
  decision?: OpportunityDecision;
  stressResults: ReturnType<typeof runStressScenarios>;
}) {
  if (!decision) return <EmptyState text="Start replay or live feeds to generate stress scenarios." />;
  const impactSummary = summarizeImpactCurve(decision.impactCurve);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <DataCell label="Best size" value={`${impactSummary.bestSizeBtc} BTC`} />
        <DataCell label="Best impact P&L" value={money.format(impactSummary.bestNetProfitUsd)} />
        <DataCell
          label="First negative"
          value={impactSummary.firstNegativeSizeBtc ? `${impactSummary.firstNegativeSizeBtc} BTC` : "none"}
        />
      </div>
      <div className="space-y-2">
        {stressResults.map((result) => (
          <div key={result.id} className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-100">{result.label}</div>
                <div className="mt-1 text-xs text-zinc-500">{result.explanation}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={result.stressedNetProfitUsd >= 0 ? "text-emerald-200" : "text-red-200"}>
                  {money.format(result.stressedNetProfitUsd)}
                </span>
                <Badge tone={result.survives ? "green" : "red"}>{result.survives ? "survives" : "reject"}</Badge>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[72px_1fr_52px] items-center gap-3 text-xs">
              <span className="text-zinc-500">P(win)</span>
              <div className="h-2 rounded bg-zinc-800">
                <div
                  className="h-2 rounded bg-emerald-400"
                  style={{ width: `${Math.max(2, result.stressedProbability * 100)}%` }}
                />
              </div>
              <span className="text-right text-zinc-300">{(result.stressedProbability * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
        This view answers the jury's hardest question: does the opportunity survive worse latency,
        thinner books, higher network fees, and a faster market, or should the bot reject it?
      </div>
    </div>
  );
}

function RiskGovernorView({ governor }: { governor: RiskGovernor }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.45fr_0.55fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Governor state</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{governor.state}</div>
          </div>
          <Badge tone={governor.state === "halt" ? "red" : governor.state === "caution" ? "amber" : "green"}>
            {governor.score}/100
          </Badge>
        </div>
        <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm leading-6 text-zinc-300">
          {governor.action}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {governor.rules.map((rule) => (
          <div key={rule.id} className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-100">{rule.label}</div>
              <Badge tone={rule.state === "halt" ? "red" : rule.state === "caution" ? "amber" : "green"}>
                {rule.state}
              </Badge>
            </div>
            <div className="mt-2 text-xs leading-5 text-zinc-400">{rule.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EdgeConvictionView({ conviction }: { conviction: EdgeConviction }) {
  const probabilityPct = conviction.posteriorProbability * 100;
  return (
    <div className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Posterior probability</div>
            <div className="mt-1 text-5xl font-semibold text-white">{probabilityPct.toFixed(1)}%</div>
          </div>
          <Badge
            tone={
              conviction.recommendation === "simulate-execute"
                ? "green"
                : conviction.recommendation === "cap-size"
                  ? "amber"
                  : conviction.recommendation === "reject"
                    ? "red"
                    : "neutral"
            }
          >
            {conviction.recommendation}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Evidence score" value={`${conviction.evidenceScore.toFixed(0)}/100`} />
          <DataCell
            label="Credible range"
            value={`${(conviction.confidenceInterval.low * 100).toFixed(1)}-${(conviction.confidenceInterval.high * 100).toFixed(1)}%`}
          />
        </div>
        <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm leading-6 text-zinc-300">
          {conviction.explanation}
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
            <span>Evidence weights</span>
            <span>negative → positive</span>
          </div>
          <div className="space-y-3">
            {conviction.factors.map((factor) => (
              <div key={factor.id}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-zinc-200">{factor.label}</span>
                  <span className={factor.weight >= 0 ? "text-emerald-200" : "text-red-200"}>
                    {factor.weight >= 0 ? "+" : ""}{factor.weight.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_1fr] gap-2">
                  <div className="h-2 rounded bg-zinc-800">
                    <div
                      className="ml-auto h-2 rounded bg-red-400"
                      style={{ width: `${factor.weight < 0 ? Math.min(100, Math.abs(factor.weight) * 45) : 0}%` }}
                    />
                  </div>
                  <div className="h-2 rounded bg-zinc-800">
                    <div
                      className="h-2 rounded bg-emerald-400"
                      style={{ width: `${factor.weight > 0 ? Math.min(100, factor.weight * 45) : 0}%` }}
                    />
                  </div>
                </div>
                <div className="mt-1 text-xs leading-5 text-zinc-500">{factor.evidence}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SequentialExecutionTestView({ test }: { test: SequentialExecutionTest }) {
  const tone =
    test.summary.decision === "accept-execute"
      ? "green"
      : test.summary.decision === "accept-cap-size"
        ? "amber"
        : test.summary.decision === "reject-execution"
          ? "red"
          : "neutral";
  const range = Math.max(0.1, test.upperBoundary - test.lowerBoundary);
  const markerPct = clampForStyle(((test.summary.finalLogLikelihood - test.lowerBoundary) / range) * 100, 0, 100);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase text-zinc-500">SPRT decision</div>
              <div className="mt-1 text-4xl font-semibold uppercase text-white">{test.summary.decision}</div>
            </div>
            <Badge tone={tone}>LLR {test.summary.finalLogLikelihood.toFixed(2)}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <DataCell label="Confidence" value={`${test.summary.confidencePct.toFixed(1)}%`} />
            <DataCell label="Evidence steps" value={String(test.summary.evidenceCount)} />
            <DataCell label="False execute risk" value={`${test.summary.falseExecuteRiskPct.toFixed(1)}%`} />
            <DataCell label="False reject risk" value={`${test.summary.falseRejectRiskPct.toFixed(1)}%`} />
          </div>
          <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
              <span>lower {test.lowerBoundary.toFixed(2)}</span>
              <span>upper {test.upperBoundary.toFixed(2)}</span>
            </div>
            <div className="relative h-3 rounded bg-zinc-800">
              <div className="absolute left-0 top-0 h-3 w-[2px] rounded bg-red-300" />
              <div className="absolute right-0 top-0 h-3 w-[2px] rounded bg-emerald-300" />
              <div
                className={`absolute top-[-3px] h-5 w-[3px] rounded ${test.summary.finalLogLikelihood >= 0 ? "bg-cyan-300" : "bg-red-300"}`}
                style={{ left: `${markerPct}%` }}
              />
            </div>
          </div>
          <div className="mt-4">
            <FormulaExplainer
              spec={{
                title: "Sequential evidence equation",
                modelId: "sequential-execution-test",
                equation: test.equation,
                plainExplanation: "Accumulates execution evidence until it crosses an execute, cap, or reject boundary instead of trusting one noisy signal.",
              }}
            />
          </div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Sequential evidence path</div>
              <div className="text-xs text-zinc-500">Wald-style accumulated log-likelihood from independent execution checks</div>
            </div>
            <Badge tone={tone}>alpha/beta gated</Badge>
          </div>
          <div className="space-y-2">
            {test.steps.map((step) => (
              <SequentialEvidenceStepRow key={step.id} step={step} lower={test.lowerBoundary} upper={test.upperBoundary} />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.48fr_0.52fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 text-sm font-semibold text-zinc-100">Decision reasons</div>
          <div className="grid gap-2 md:grid-cols-2">
            {test.reasons.map((reason) => (
              <div key={reason} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-300">
                {reason}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-4">
          <div className="text-sm font-semibold text-cyan-100">Quant explanation</div>
          <div className="mt-2 text-xs leading-5 text-cyan-100">
            H1 means the edge is executable after public-market frictions; H0 means the apparent edge is not executable.
            Each signal contributes log(P(evidence|H1) / P(evidence|H0)). The simulator executes only when evidence crosses
            the upper boundary, caps size when constraints demand caution, and rejects on hard blockers or the lower boundary.
          </div>
        </div>
      </div>
    </div>
  );
}

function SequentialEvidenceStepRow({
  step,
  lower,
  upper,
}: {
  step: SequentialEvidenceStep;
  lower: number;
  upper: number;
}) {
  const range = Math.max(0.1, upper - lower);
  const widthPct = clampForStyle((Math.abs(step.logLikelihood) / range) * 100, 4, 100);
  const cumulativePct = clampForStyle(((step.cumulativeLogLikelihood - lower) / range) * 100, 0, 100);
  const tone =
    step.direction === "supports-execution" ? "green" : step.direction === "supports-rejection" ? "red" : "neutral";
  const barClass =
    step.direction === "supports-execution"
      ? "bg-emerald-400"
      : step.direction === "supports-rejection"
        ? "bg-red-400"
        : "bg-zinc-500";

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{step.label}</div>
          <div className="mt-1 text-xs leading-5 text-zinc-500">{step.evidence}</div>
        </div>
        <Badge tone={tone}>{step.logLikelihood >= 0 ? "+" : ""}{step.logLikelihood.toFixed(2)}</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[0.48fr_0.52fr]">
        <div className="grid grid-cols-[1fr_1fr] gap-1">
          <div className="h-2 rounded bg-zinc-800">
            <div
              className={`ml-auto h-2 rounded ${step.logLikelihood < 0 ? barClass : "bg-transparent"}`}
              style={{ width: `${step.logLikelihood < 0 ? widthPct : 0}%` }}
            />
          </div>
          <div className="h-2 rounded bg-zinc-800">
            <div
              className={`h-2 rounded ${step.logLikelihood > 0 ? barClass : "bg-transparent"}`}
              style={{ width: `${step.logLikelihood > 0 ? widthPct : 0}%` }}
            />
          </div>
        </div>
        <div className="relative h-2 rounded bg-zinc-800">
          <div className="absolute left-0 top-0 h-2 w-[2px] bg-red-300" />
          <div className="absolute right-0 top-0 h-2 w-[2px] bg-emerald-300" />
          <div className="absolute top-[-2px] h-4 w-[2px] rounded bg-cyan-300" style={{ left: `${cumulativePct}%` }} />
        </div>
      </div>
    </div>
  );
}

function clampForStyle(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function CausalExecutionGraphView({ graph }: { graph: CausalExecutionGraph }) {
  const groups: Array<{ id: CausalExecutionNode["group"]; label: string }> = [
    { id: "market", label: "Market" },
    { id: "validation", label: "Validation" },
    { id: "execution", label: "Execution" },
    { id: "risk", label: "Risk" },
    { id: "decision", label: "Decision" },
  ];
  const finalTone =
    graph.summary.finalDecision === "execute-simulated"
      ? "green"
      : graph.summary.finalDecision === "halt-simulated"
        ? "red"
        : graph.summary.finalDecision === "cap-size"
          ? "amber"
          : "neutral";
  const severityRows = graph.nodes
    .filter((node) => node.id !== "final-decision")
    .sort((a, b) => causalStateSeverity(b.state) - causalStateSeverity(a.state) || a.score - b.score)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase text-zinc-500">Final policy</div>
              <div className="mt-1 text-4xl font-semibold uppercase text-white">{graph.summary.finalDecision}</div>
            </div>
            <Badge tone={finalTone}>{graph.summary.blockerCount} blockers</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <DataCell label="Support" value={`${graph.summary.supportScore.toFixed(0)}/100`} />
            <DataCell label="Drag" value={`${graph.summary.dragScore.toFixed(0)}/100`} />
            <DataCell label="Weakest link" value={graph.summary.weakestLink?.label ?? "none"} />
            <DataCell label="Evidence nodes" value={String(graph.nodes.length - 1)} />
          </div>
          <div className="mt-4">
            <FormulaExplainer
              spec={{
                title: "Causal execution graph equation",
                modelId: "causal-execution-graph",
                equation: graph.equation,
                plainExplanation: "Turns public evidence nodes into support and drag scores, then exposes the weakest link before simulated execution.",
              }}
            />
          </div>
          <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
            {graph.summary.explanation}
          </div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Directed evidence chain</div>
              <div className="text-xs text-zinc-500">from public market evidence to simulated action</div>
            </div>
            <Badge tone={graph.summary.blockerCount > 0 ? "red" : graph.summary.dragScore > 0 ? "amber" : "green"}>
              auditable path
            </Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            {groups.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="text-xs uppercase text-zinc-500">{group.label}</div>
                {graph.nodes
                  .filter((node) => node.group === group.id)
                  .map((node) => (
                    <CausalNodeCard key={node.id} node={node} />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.58fr_0.42fr]">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 text-sm font-semibold text-zinc-100">Causal edges</div>
          <div className="grid gap-2 md:grid-cols-3">
            {graph.edges.map((edge) => (
              <div key={`${edge.from}-${edge.to}`} className="rounded border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-zinc-300">{edge.from}</span>
                  <span className="text-cyan-200">→</span>
                  <span className="truncate text-zinc-300">{edge.to}</span>
                </div>
                <div className="mt-2 h-2 rounded bg-zinc-800">
                  <div className="h-2 rounded bg-cyan-300" style={{ width: `${Math.max(4, edge.weight * 100)}%` }} />
                </div>
                <div className="mt-2 text-xs leading-5 text-zinc-500">{edge.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 text-sm font-semibold text-zinc-100">Blockers and drags</div>
          <div className="space-y-2">
            {severityRows.map((node) => (
              <div key={node.id} className="rounded border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-zinc-100">{node.label}</span>
                  <Badge tone={causalTone(node.state)}>{node.state}</Badge>
                </div>
                <div className="mt-2 text-xs leading-5 text-zinc-500">{node.evidence}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CausalNodeCard({ node }: { node: CausalExecutionNode }) {
  return (
    <div className="min-h-[132px] rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-zinc-100">{node.label}</div>
        <Badge tone={causalTone(node.state)}>{node.score}/100</Badge>
      </div>
      <div className="mt-2 h-2 rounded bg-zinc-800">
        <div className={`h-2 rounded ${causalBarClass(node.state)}`} style={{ width: `${Math.max(4, node.score)}%` }} />
      </div>
      <div className="mt-2 text-xs uppercase text-zinc-500">{node.state}</div>
      <div className="mt-2 text-xs leading-5 text-zinc-400">{node.evidence}</div>
    </div>
  );
}

function causalTone(state: CausalExecutionNode["state"]): "green" | "amber" | "red" | "neutral" {
  if (state === "support") return "green";
  if (state === "drag") return "amber";
  if (state === "blocker") return "red";
  return "neutral";
}

function causalBarClass(state: CausalExecutionNode["state"]): string {
  if (state === "support") return "bg-emerald-400";
  if (state === "drag") return "bg-amber-400";
  if (state === "blocker") return "bg-red-400";
  return "bg-zinc-500";
}

function causalStateSeverity(state: CausalExecutionNode["state"]): number {
  if (state === "blocker") return 4;
  if (state === "drag") return 3;
  if (state === "missing") return 2;
  return 1;
}

function ExecutionPlaybookView({ playbook }: { playbook: ExecutionPlaybook }) {
  const recommended = playbook.actions[0];
  const tone =
    playbook.summary.recommendedAction === "halt"
      ? "red"
      : playbook.summary.recommendedAction === "wait-for-evidence" || playbook.summary.recommendedAction === "rebalance"
        ? "amber"
        : "green";
  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Recommended action</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{playbook.summary.recommendedAction}</div>
          </div>
          <Badge tone={tone}>{recommended?.actionScore ?? 0}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Expected P&L" value={money.format(playbook.summary.expectedPnlUsd)} />
          <DataCell label="Risk score" value={`${playbook.summary.riskScore}/100`} />
          <DataCell label="Confidence" value={`${playbook.summary.confidence}/100`} />
          <DataCell label="Explainability" value={`${playbook.summary.explainabilityScore}/100`} />
        </div>
        <FormulaExplainer
          spec={{
            title: "Execution playbook equation",
            modelId: "execution-playbook",
            equation: playbook.equation,
            plainExplanation:
              "Ranks simulated actions after fusing live route, smart routing, maker/taker queue, venue failure, settlement risk, historical clusters, and execution regime into one auditable playbook.",
          }}
        />
        {playbook.summary.hardStops.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {playbook.summary.hardStops.map((stop) => (
              <Badge key={stop} tone="red">
                {stop}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
          Ranks simulated actions after fusing live route, smart routing, maker/taker queue, venue failure,
          settlement risk, historical clusters, and execution regime into one auditable playbook.
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {playbook.actions.map((action) => (
          <ExecutionPlaybookActionCard key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
}

function ExecutionPlaybookActionCard({ action }: { action: ExecutionPlaybookAction }) {
  const tone = action.id === "halt" ? "red" : action.actionScore >= 72 ? "green" : action.actionScore >= 48 ? "amber" : "neutral";
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{action.label}</div>
          <div className="mt-1 text-xs text-zinc-500">simulated action · no keys · no real orders</div>
        </div>
        <Badge tone={tone}>{action.actionScore}/100</Badge>
      </div>
      <div className="mt-3 h-3 rounded bg-zinc-800">
        <div
          className={action.id === "halt" ? "h-3 rounded bg-red-400" : action.actionScore >= 72 ? "h-3 rounded bg-emerald-400" : "h-3 rounded bg-amber-400"}
          style={{ width: `${Math.max(3, Math.min(100, action.actionScore))}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DataCell label="P&L" value={money.format(action.expectedPnlUsd)} />
        <DataCell label="Risk" value={`${action.riskScore}/100`} />
        <DataCell label="Confidence" value={`${action.confidence}/100`} />
        <DataCell label="Mode" value={action.id} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {action.reasons.slice(0, 4).map((reason) => (
          <Badge key={reason} tone={reason.includes("halt") || reason.includes("hard stop") ? "red" : reason.includes("waiting") || reason.includes("missing") ? "amber" : "green"}>
            {reason}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ExecutionRegimeFusionView({ fusion }: { fusion: ExecutionRegimeFusion }) {
  const actionTone =
    fusion.action === "simulate-execute"
      ? "green"
      : fusion.action === "cap-size"
        ? "amber"
        : fusion.action === "halt"
          ? "red"
          : "neutral";
  return (
    <div className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Fused regime score</div>
            <div className="mt-1 text-5xl font-semibold text-white">{fusion.score}</div>
          </div>
          <Badge tone={actionTone}>{fusion.action}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Confidence" value={fusion.confidence} />
          <DataCell label="Fused haircut" value={`${fusion.combinedHaircutBps.toFixed(2)} bps`} />
          <DataCell label="Signals" value={`${fusion.factors.filter((factor) => factor.state !== "missing").length}/${fusion.factors.length}`} />
          <DataCell label="Sources" value={String(fusion.sources.length)} />
        </div>
        <FormulaExplainer
          spec={{
            modelId: "execution-regime",
            title: "Cross-signal execution policy",
            equation: fusion.formula,
            plainExplanation:
              "Fuses market context, trade tape, lead-lag, derivatives, basis, consensus, liquidity, latency, and venue reliability into one execution haircut and policy.",
            variables: [
              { symbol: "score", label: "regime score", value: fusion.score },
              { symbol: "haircut", label: "combined haircut", value: `${fusion.combinedHaircutBps.toFixed(2)} bps` },
              { symbol: "confidence", label: "confidence", value: fusion.confidence },
            ],
          }}
        />
        <div className="mt-3 space-y-2">
          {fusion.hardStops.length > 0 ? (
            fusion.hardStops.map((stop) => (
              <div key={stop} className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-100">
                {stop}
              </div>
            ))
          ) : (
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-100">
              No cross-signal hard stop is active.
            </div>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {fusion.factors.map((factor) => {
          const tone =
            factor.state === "positive"
              ? "green"
              : factor.state === "warning"
                ? "amber"
                : factor.state === "critical"
                  ? "red"
                  : factor.state === "missing"
                    ? "neutral"
                    : "cyan";
          const barColor =
            factor.state === "critical"
              ? "bg-red-400"
              : factor.state === "warning"
                ? "bg-amber-300"
                : factor.state === "missing"
                  ? "bg-zinc-600"
                  : "bg-emerald-400";
          return (
            <div key={factor.id} className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">{factor.label}</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">{factor.evidence}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">{factor.haircutBps.toFixed(2)} bps</span>
                  <Badge tone={tone}>{factor.state}</Badge>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[42px_1fr_38px] items-center gap-3 text-xs">
                <span className="text-zinc-500">score</span>
                <div className="h-2 rounded bg-zinc-800">
                  <div className={`h-2 rounded ${barColor}`} style={{ width: `${Math.max(2, factor.score)}%` }} />
                </div>
                <span className="text-right text-zinc-300">{factor.score}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CapitalAllocationOptimizerView({ optimizer }: { optimizer: CapitalAllocationOptimizer }) {
  const policyTone =
    optimizer.summary.policy === "deploy" ? "green" : optimizer.summary.policy === "selective" ? "amber" : "red";
  const maxScore = Math.max(1, ...optimizer.allocations.map((item) => item.riskAdjustedScore));
  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Portfolio policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{optimizer.summary.policy}</div>
          </div>
          <Badge tone={policyTone}>{optimizer.summary.activeStrategies} active</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Bankroll" value={compactUsd(optimizer.bankrollUsd)} />
          <DataCell label="Allocated" value={compactUsd(optimizer.summary.allocatedUsd)} />
          <DataCell label="Idle" value={compactUsd(optimizer.summary.idleUsd)} />
          <DataCell label="Expected P&L" value={money.format(optimizer.summary.expectedPnlUsd)} />
          <DataCell label="Return" value={`${optimizer.summary.portfolioReturnBps.toFixed(2)} bps`} />
          <DataCell label="CVaR" value={`${optimizer.summary.portfolioCvarBps.toFixed(2)} bps`} />
        </div>
        <FormulaExplainer
          spec={{
            title: "Capital allocation equation",
            modelId: "capital-allocation",
            equation: optimizer.equation,
            plainExplanation:
              "Allocates simulated capital only after expected return, CVaR, capacity, confidence, and settlement risk survive the portfolio gate.",
          }}
        />
        <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
          Allocates simulated capital only after each strategy survives edge, risk, confidence, capacity,
          and settlement-risk gates. Unused capital stays idle instead of forcing weak trades.
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {optimizer.allocations.map((allocation) => {
          const width = Math.max(3, Math.min(100, (allocation.riskAdjustedScore / maxScore) * 100));
          return (
            <div key={allocation.id} className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">{allocation.label}</div>
                  <div className="mt-1 text-xs text-zinc-500">{allocation.evidence}</div>
                </div>
                <Badge tone={allocationDecisionTone(allocation.decision)}>{allocation.decision}</Badge>
              </div>
              <div className="mt-3 h-3 rounded bg-zinc-800">
                <div
                  className={
                    allocation.decision === "increase"
                      ? "h-3 rounded bg-emerald-400"
                      : allocation.decision === "cap"
                        ? "h-3 rounded bg-amber-400"
                        : "h-3 rounded bg-zinc-600"
                  }
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <DataCell label="Capital" value={compactUsd(allocation.capitalUsd)} />
                <DataCell label="Weight" value={`${(allocation.targetWeight * 100).toFixed(1)}%`} />
                <DataCell label="Score" value={`${allocation.riskAdjustedScore}/100`} />
                <DataCell label="Edge" value={`${allocation.expectedReturnBps.toFixed(2)} bps`} />
                <DataCell label="P&L" value={money.format(allocation.expectedPnlUsd)} />
                <DataCell label="CVaR" value={money.format(allocation.cvarUsd)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {allocation.reasons.length > 0 ? (
                  allocation.reasons.map((reason) => (
                    <Badge key={reason} tone={reason.includes("missing") || reason.includes("negative") ? "red" : "amber"}>
                      {reason}
                    </Badge>
                  ))
                ) : (
                  <Badge tone="green">eligible for simulated deployment</Badge>
                )}
                <Badge tone="cyan">{allocation.sourceCount} sources</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function allocationDecisionTone(decision: "increase" | "cap" | "skip"): "green" | "amber" | "red" {
  if (decision === "increase") return "green";
  if (decision === "cap") return "amber";
  return "red";
}

function EngineThroughputLabView({ lab }: { lab: EngineThroughputLab }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">SLA status</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{lab.sla.status}</div>
          </div>
          <Badge tone={lab.sla.status === "pass" ? "green" : lab.sla.status === "watch" ? "amber" : "red"}>
            {lab.sla.utilizationPct.toFixed(1)}%
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Decisions/sec" value={Math.round(lab.estimatedDecisionsPerSecond).toLocaleString("en-US")} />
          <DataCell label="P95 cycle" value={`${lab.p95CycleMs.toFixed(3)}ms`} />
          <DataCell label="Headroom" value={`${lab.sla.headroomMs.toFixed(1)}ms`} />
          <DataCell label="Budget" value={`${lab.sla.latencyBudgetMs}ms`} />
        </div>
        {lab.usedFixture && (
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            Fewer than two live books are available, so this uses deterministic fixture books for a stable demo benchmark.
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <DataCell label="Venues" value={String(lab.venues)} />
          <DataCell label="Comparisons/cycle" value={String(lab.directedComparisons)} />
          <DataCell label="Cycles" value={String(lab.cycles)} />
          <DataCell label="Evaluations" value={lab.totalEvaluations.toLocaleString("en-US")} />
          <DataCell label="Accepted evals" value={String(lab.acceptedRoutes)} />
          <DataCell label="Rejected evals" value={String(lab.rejectedRoutes)} />
          <DataCell label="Best net" value={money.format(lab.bestNetProfitUsd)} />
          <DataCell label="Max cycle" value={`${lab.maxCycleMs.toFixed(3)}ms`} />
        </div>
        <ThroughputBar lab={lab} />
        <div className="grid gap-2 md:grid-cols-3">
          {lab.notes.map((note) => (
            <div key={note} className="rounded border border-zinc-800 bg-zinc-900 p-3 text-xs leading-5 text-zinc-300">
              {note}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThroughputBar({ lab }: { lab: EngineThroughputLab }) {
  const p95Width = Math.min(100, Math.max(2, lab.sla.utilizationPct));
  const p50Width = Math.min(100, Math.max(2, (lab.p50CycleMs / Math.max(1, lab.sla.latencyBudgetMs)) * 100));
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
        <span>Latency budget utilization</span>
        <span>{lab.p50CycleMs.toFixed(3)}ms p50 · {lab.p95CycleMs.toFixed(3)}ms p95</span>
      </div>
      <div className="relative h-7 rounded bg-zinc-800">
        <div className="absolute left-0 top-0 h-7 rounded bg-cyan-400/60" style={{ width: `${p50Width}%` }} />
        <div className="absolute left-0 top-0 h-7 rounded bg-emerald-400/70" style={{ width: `${p95Width}%` }} />
        <div className="absolute inset-y-0 right-0 w-px bg-zinc-500" />
      </div>
    </div>
  );
}

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function VenueReliabilityOracleView({ oracle, compact = false }: { oracle?: VenueReliabilityOracle; compact?: boolean }) {
  if (!oracle) return <EmptyState text="Loading public venue status pages and operational latency checks." />;
  const policyTone =
    oracle.summary.policy === "allow-routing"
      ? "green"
      : oracle.summary.policy === "cap-degraded-venues"
        ? "amber"
        : "red";
  const visible = compact ? oracle.venues.slice(0, 4) : oracle.venues;
  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Operational policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{oracle.summary.policy}</div>
          </div>
          <Badge tone={policyTone}>{oracle.summary.averageScore.toFixed(0)}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Venues" value={String(oracle.summary.venueCount)} />
          <DataCell label="Healthy" value={String(oracle.summary.healthyVenues)} />
          <DataCell label="Capped" value={String(oracle.summary.cappedVenues)} />
          <DataCell label="Halted" value={String(oracle.summary.haltedVenues)} />
          <DataCell label="Worst venue" value={oracle.summary.worstVenue ?? "unknown"} />
          <DataCell label="Haircut" value={`${oracle.summary.totalHaircutBps.toFixed(2)} bps`} />
        </div>
        <div className="mt-4">
          <FormulaExplainer
            spec={{
              title: "Venue reliability equation",
              modelId: "venue-reliability",
              equation: oracle.equation,
              plainExplanation: "Combines public venue status and endpoint latency into an allow, cap, or halt routing policy.",
            }}
          />
        </div>
        <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
          Combines public exchange status pages with endpoint latency to gate simulated routing before a venue can
          receive capital. A venue can be allowed, capped, or halted even when its order book still looks tradable.
        </div>
        {oracle.errors.length > 0 && (
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Reliability oracle degraded gracefully: {oracle.errors.length} public status source issue(s).
          </div>
        )}
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {visible.map((venue) => (
          <VenueReliabilityRow key={venue.venue} venue={venue} />
        ))}
      </div>
    </div>
  );
}

function VenueReliabilityRow({ venue }: { venue: VenueReliabilityScore }) {
  const tone = venue.policy === "allow" ? "green" : venue.policy === "cap-size" ? "amber" : "red";
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{venue.label}</div>
          <div className="mt-1 text-xs text-zinc-500">{venue.description}</div>
        </div>
        <Badge tone={tone}>{venue.policy}</Badge>
      </div>
      <div className="mt-3 h-3 rounded bg-zinc-800">
        <div
          className={venue.policy === "allow" ? "h-3 rounded bg-emerald-400" : venue.policy === "cap-size" ? "h-3 rounded bg-amber-400" : "h-3 rounded bg-red-400"}
          style={{ width: `${Math.max(3, Math.min(100, venue.operationalScore))}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DataCell label="Score" value={`${venue.operationalScore}/100`} />
        <DataCell label="Status" value={venue.indicator} />
        <DataCell label="P95 latency" value={venue.latencyP95Ms ? `${venue.latencyP95Ms.toFixed(0)}ms` : "unmeasured"} />
        <DataCell label="Haircut" value={`${venue.totalHaircutBps.toFixed(2)} bps`} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {venue.reasons.length > 0 ? (
          venue.reasons.map((reason) => (
            <Badge key={reason} tone={reason.includes("critical") || reason.includes("error") ? "red" : "amber"}>
              {reason}
            </Badge>
          ))
        ) : (
          <Badge tone="green">public status clear</Badge>
        )}
      </div>
    </div>
  );
}

function VenueFailureWarGameView({ game, compact = false }: { game: VenueFailureWarGame; compact?: boolean }) {
  if (game.scenarios.length === 0) {
    return <EmptyState text="Start replay or live feeds to generate an accepted route, then the venue failure simulator will war-game it." />;
  }
  const policyTone =
    game.summary.policy === "route-allowed"
      ? "green"
      : game.summary.policy === "halt-route"
        ? "red"
        : game.summary.policy === "standby"
          ? "neutral"
          : "amber";
  const visible = compact ? game.scenarios.slice(0, 2) : game.scenarios;
  return (
    <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Failure policy</div>
            <div className="mt-1 text-4xl font-semibold uppercase text-white">{game.summary.policy}</div>
          </div>
          <Badge tone={policyTone}>{game.summary.haltedScenarios} halted</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Worst scenario" value={game.summary.worstScenario ?? "unknown"} />
          <DataCell label="Worst loss" value={money.format(game.summary.worstLossUsd)} />
          <DataCell label="Trapped capital" value={compactUsd(game.summary.trappedCapitalUsd)} />
          <DataCell label="Failover venues" value={game.summary.failoverVenues.length ? game.summary.failoverVenues.join(", ") : "none"} />
        </div>
        <div className="mt-4">
          <FormulaExplainer
            spec={{
              title: "Venue failure war-game equation",
              modelId: "venue-failure-war-game",
              equation: game.equation,
              plainExplanation: "Prices the emergency unwind, trapped capital, and backup inventory before a simulated route is allowed through a venue outage scenario.",
            }}
          />
        </div>
        <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
          Simulates venue outage after one leg, calculates emergency unwind price, checks prefunded backup inventory,
          and decides whether to fail over, cap size, or halt the route before a real bot would strand capital.
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-3">
        {visible.map((scenario) => (
          <VenueFailureScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </div>
    </div>
  );
}

function VenueFailureScenarioCard({ scenario }: { scenario: VenueFailureScenario }) {
  const tone =
    scenario.recoveryAction === "route-to-backup-venue"
      ? "amber"
      : scenario.recoveryAction === "halt-and-internalize"
        ? "red"
        : scenario.recoveryAction === "continue-with-monitoring"
          ? "green"
          : "neutral";
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{scenario.label}</div>
          <div className="mt-1 text-xs capitalize text-zinc-500">
            failed venue: {scenario.failedVenue} · score {scenario.failedVenueScore}/100
          </div>
        </div>
        <Badge tone={tone}>{scenario.recoveryAction}</Badge>
      </div>
      <div className="mt-3 h-3 rounded bg-zinc-800">
        <div
          className={scenario.recoveryAction === "halt-and-internalize" ? "h-3 rounded bg-red-400" : scenario.recoveryAction === "route-to-backup-venue" ? "h-3 rounded bg-amber-400" : "h-3 rounded bg-emerald-400"}
          style={{ width: `${Math.max(4, Math.min(100, scenario.riskScore))}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DataCell label="Unwind P&L" value={money.format(scenario.unwindPnlUsd)} />
        <DataCell label="Trapped" value={compactUsd(scenario.trappedCapitalUsd)} />
        <DataCell label="Emergency price" value={money.format(scenario.emergencyPriceUsd)} />
        <DataCell label="Haircut" value={`${scenario.haircutBps.toFixed(2)} bps`} />
        <DataCell label="Backup" value={scenario.backupVenue ?? "none"} />
        <DataCell label="Risk" value={`${scenario.riskScore}/100`} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {scenario.reasons.slice(0, 4).map((reason) => (
          <Badge key={reason} tone={reason.includes("loss") || reason.includes("stranded") || reason.includes("no backup") ? "red" : "amber"}>
            {reason}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function VenueLatencyRaceView({ race }: { race?: VenueLatencyRace }) {
  if (!race) return <EmptyState text="Measuring public REST endpoint latency across venues." />;
  const maxP95 = Math.max(1, ...race.venues.map((venue) => venue.p95Ms));
  return (
    <div className="grid gap-4 xl:grid-cols-[0.32fr_0.68fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Fastest venue</div>
            <div className="mt-1 text-4xl font-semibold capitalize text-white">{race.summary.fastestVenue}</div>
          </div>
          <Badge tone={race.summary.degradedVenues === 0 ? "green" : race.summary.degradedVenues <= 2 ? "amber" : "red"}>
            {race.summary.bestScore.toFixed(0)}/100
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Venues" value={String(race.summary.venueCount)} />
          <DataCell label="Median p95" value={`${race.summary.medianP95Ms.toFixed(0)}ms`} />
          <DataCell label="Latency budget" value={`${race.latencyBudgetMs}ms`} />
          <DataCell label="Best haircut" value={money.format(race.summary.lowestPenaltyUsd)} />
        </div>
        <div className="mt-4 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
          Each venue is sampled three times from the app runtime. Score combines p95 latency, jitter,
          availability, and expected P&L haircut for a {compactUsd(race.notionalUsd)} route.
        </div>
      </div>
      <div className="space-y-2">
        {race.venues.map((venue) => (
          <VenueLatencyRow key={venue.venue} venue={venue} maxP95={maxP95} />
        ))}
        {race.errors.length > 0 && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Latency race degraded gracefully: {race.errors.length} failed sample(s).
          </div>
        )}
      </div>
    </div>
  );
}

function VenueLatencyRow({ venue, maxP95 }: { venue: VenueLatencyScore; maxP95: number }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{venue.label}</div>
          <div className="mt-1 text-xs text-zinc-500">{venue.reason}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-200">{venue.score.toFixed(0)}/100</span>
          <Badge tone={venue.status === "pass" ? "green" : venue.status === "watch" ? "amber" : "red"}>
            {venue.status}
          </Badge>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_88px_88px_88px_110px]">
        <div className="h-3 rounded bg-zinc-800">
          <div
            className={venue.status === "pass" ? "h-3 rounded bg-emerald-400" : venue.status === "watch" ? "h-3 rounded bg-amber-400" : "h-3 rounded bg-red-400"}
            style={{ width: `${Math.max(4, Math.min(100, (venue.p95Ms / maxP95) * 100))}%` }}
          />
        </div>
        <span className="text-xs text-zinc-400">p50 {venue.p50Ms.toFixed(0)}ms</span>
        <span className="text-xs text-zinc-400">p95 {venue.p95Ms.toFixed(0)}ms</span>
        <span className="text-xs text-zinc-400">jit {venue.jitterMs.toFixed(0)}ms</span>
        <span className="text-right text-xs text-zinc-300">{money.format(venue.latencyPenaltyUsd)}</span>
      </div>
    </div>
  );
}

function WalletTable({ wallets }: { wallets: Record<string, { BTC: number; USD: number; USDT: number }> }) {
  const rows = Object.entries(wallets);
  if (rows.length === 0) return <EmptyState text="Wallets initialize when live or replay starts." />;
  return (
    <div className="space-y-2">
      {rows.map(([exchange, wallet]) => (
        <div key={exchange} className="grid grid-cols-[0.8fr_1fr] gap-2 rounded border border-zinc-800 bg-zinc-900 p-2 text-xs">
          <div className="font-medium capitalize text-zinc-100">{exchange}</div>
          <div className="text-right text-zinc-300">
            {btc.format(wallet.BTC)} BTC · {money.format(wallet.USD)} · {money.format(wallet.USDT)} USDT
          </div>
        </div>
      ))}
    </div>
  );
}

function SettlementRiskOracleView({ oracle }: { oracle?: SettlementRiskOracle }) {
  if (!oracle) return <EmptyState text="Loading mempool.space projected blocks and recommended Bitcoin fee tiers." />;
  const tone =
    oracle.summary.policy === "rebalance-now"
      ? "green"
      : oracle.summary.policy === "batch-rebalance"
        ? "amber"
        : oracle.summary.policy === "halt-withdrawals"
          ? "red"
          : "neutral";
  const maxFee = Math.max(1, ...oracle.tiers.map((tier) => tier.feeSatVb));
  return (
    <div className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr]">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Settlement policy</div>
            <div className="mt-1 text-3xl font-semibold uppercase text-white">{oracle.summary.pressure}</div>
          </div>
          <Badge tone={tone}>{oracle.summary.policy}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <DataCell label="Fastest fee" value={money.format(oracle.summary.fastestFeeUsd)} />
          <DataCell label="Economy fee" value={money.format(oracle.summary.economyFeeUsd)} />
          <DataCell label="Projected blocks" value={String(oracle.summary.projectedBlocks)} />
          <DataCell label="Stranding risk" value={`${oracle.summary.strandingRiskScore}/100`} />
          <DataCell label="Mempool depth" value={`${oracle.summary.mempoolDepthVmb.toFixed(2)} vMB`} />
          <DataCell label="Penalty" value={`${oracle.summary.settlementPenaltyBps.toFixed(2)} bps`} />
        </div>
        <Alert className="mt-4 border-cyan-500/30 bg-cyan-500/10">
          <AlertTitle>Settlement interpretation</AlertTitle>
          <AlertDescription>{oracle.explanation}</AlertDescription>
        </Alert>
        {oracle.errors.length > 0 && (
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            Settlement oracle degraded gracefully: {oracle.errors.length} source issue(s).
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="grid gap-2 md:grid-cols-4">
          {oracle.tiers.map((tier) => (
            <SettlementTierCard key={tier.id} tier={tier} maxFee={maxFee} />
          ))}
        </div>
        <MempoolBlockChart oracle={oracle} />
      </div>
    </div>
  );
}

function SettlementTierCard({ tier, maxFee }: { tier: SettlementTier; maxFee: number }) {
  const tone = tier.confidence === "high" ? "green" : tier.confidence === "medium" ? "amber" : "red";
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{tier.label}</div>
          <div className="mt-1 text-xs text-zinc-500">{tier.estimatedMinutes} min ETA</div>
        </div>
        <Badge tone={tone}>{tier.confidence}</Badge>
      </div>
      <div className="mt-3 h-2 rounded bg-zinc-800">
        <div className="h-2 rounded bg-cyan-300" style={{ width: `${Math.max(4, (tier.feeSatVb / maxFee) * 100)}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DataCell label="sat/vB" value={tier.feeSatVb.toFixed(0)} />
        <DataCell label="cost" value={money.format(tier.feeUsd)} />
      </div>
    </div>
  );
}

function MempoolBlockChart({ oracle }: { oracle: SettlementRiskOracle }) {
  if (oracle.blocks.length === 0) {
    return <EmptyState text="Projected mempool blocks unavailable from mempool.space; recommended fee tiers are still shown." />;
  }
  const maxFee = Math.max(1, ...oracle.blocks.map((block) => block.maxFeeRate));
  const visible = oracle.blocks.slice(0, 8);
  const medians = visible.map((block) => block.medianFeeRate);
  const summary = summarizeChartSeries(medians);
  return (
    <ChartFrame
      title="Projected mempool blocks"
      source="mempool.space"
      description="Bars compare min and median fee rate against the observed max fee range."
      metrics={[
        { label: "Blocks", value: String(summary.count), tone: "neutral" },
        { label: "Median max", value: `${summary.max.toFixed(0)} sat/vB`, tone: "amber" },
        { label: "Trend", value: summary.trend, tone: summary.trend === "down" ? "green" : summary.trend === "up" ? "amber" : "neutral" },
      ]}
    >
      <div className="space-y-2">
        {visible.map((block) => (
          <div key={block.index} className="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-3 text-xs sm:grid-cols-[58px_minmax(0,1fr)_120px]">
            <span className="text-zinc-400">+{(block.index + 1) * 10}m</span>
            <div className="h-3 rounded bg-zinc-800">
              <div className="h-3 rounded bg-emerald-400" style={{ width: `${Math.max(4, (block.minFeeRate / maxFee) * 100)}%` }} />
              <div className="-mt-3 h-3 rounded bg-cyan-300/70" style={{ width: `${Math.max(4, (block.medianFeeRate / maxFee) * 100)}%` }} />
            </div>
            <span className="col-span-2 text-right text-zinc-300 sm:col-span-1">
              {block.minFeeRate.toFixed(0)}-{block.maxFeeRate.toFixed(0)} sat/vB
            </span>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}

function RebalancePlannerView({ planner }: { planner: RebalancePlanner }) {
  if (planner.venues.length === 0) {
    return <EmptyState text="Start live feeds or replay to initialize simulated wallets for rebalancing." />;
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr]">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <DataCell label="Policy" value={planner.policy} />
          <DataCell label="Capital" value={compactUsd(planner.summary.totalCapitalUsd)} />
          <DataCell label="BTC allocation" value={`${planner.summary.btcAllocationPct.toFixed(1)}%`} />
          <DataCell label="Rebalance cost" value={money.format(planner.summary.estimatedTotalRebalanceCostUsd)} />
          <DataCell label="Buy constrained" value={String(planner.summary.buyConstrainedVenues)} />
          <DataCell label="Sell constrained" value={String(planner.summary.sellConstrainedVenues)} />
        </div>
        <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
          Uses simulated wallets plus public mempool fee context to decide whether capital should stay put,
          be capped to internal inventory, or be rebalanced later.
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs uppercase text-zinc-500">Venue capacity</div>
          <div className="max-h-[330px] space-y-2 overflow-auto pr-1">
            {planner.venues.map((venue) => (
              <div key={venue.exchangeId} className="rounded border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold capitalize text-zinc-100">{venue.exchangeId}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      buy cap {btc.format(venue.buyCapacityBtc)} BTC · sell cap {btc.format(venue.sellCapacityBtc)} BTC
                    </div>
                  </div>
                  <Badge tone={venue.status === "balanced" ? "green" : venue.status === "thin-both" ? "red" : "amber"}>
                    {venue.status}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <DataCell label="BTC drift" value={`${venue.btcDrift >= 0 ? "+" : ""}${btc.format(venue.btcDrift)} BTC`} />
                  <DataCell label="Quote drift" value={money.format(venue.quoteDriftUsd)} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs uppercase text-zinc-500">Simulated rebalance actions</div>
          <div className="max-h-[330px] space-y-2 overflow-auto pr-1">
            {planner.actions.length === 0 ? (
              <EmptyState text="No simulated transfer is needed under the current inventory policy." />
            ) : (
              planner.actions.map((action) => (
                <div key={`${action.fromExchange}-${action.toExchange}-${action.amount}`} className="rounded border border-zinc-800 bg-zinc-900 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold capitalize text-zinc-100">
                        {action.fromExchange} → {action.toExchange}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">{action.reason}</div>
                    </div>
                    <Badge tone={action.priority >= 80 ? "red" : action.priority >= 65 ? "amber" : "cyan"}>
                      {action.priority.toFixed(0)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <DataCell label="Amount" value={`${btc.format(action.amount)} ${action.asset}`} />
                    <DataCell label="Cost" value={money.format(action.estimatedCostUsd)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PnlChart({ trades }: { trades: TradeEvent[] }) {
  const points = useMemo(() => [...trades].reverse().map((trade) => trade.cumulativePnlUsd), [trades]);
  if (points.length < 2) {
    return (
      <EmptyState text="P&L curve needs at least two accepted simulated trades. Use Replay for deterministic fills or keep Live feeds running until an accepted route appears." />
    );
  }
  const summary = summarizeChartSeries(points);
  const domain = chartDomain(points);
  const chartPoints = buildPolylinePoints(points, { width: 100, height: 100, padding: 8 });
  const zeroY = 8 + (1 - (0 - domain.min) / domain.range) * 84;
  return (
    <ChartFrame
      title="P&L curve"
      source="simulated fills"
      description={`${points.length} accepted trade marks`}
      metrics={[
        { label: "Marks", value: String(summary.count), tone: "neutral" },
        { label: "Current", value: money.format(summary.last), tone: summary.last >= 0 ? "green" : "red" },
        { label: "Delta", value: money.format(summary.delta), tone: summary.delta >= 0 ? "green" : "red" },
      ]}
    >
      <AccessibleChartSvg
        title="Accepted trade P&L curve"
        description={`Cumulative simulated P&L across ${points.length} accepted trade marks.`}
        className="h-52"
      >
        <line x1="8" y1={Math.max(8, Math.min(92, zeroY))} x2="92" y2={Math.max(8, Math.min(92, zeroY))} stroke="rgb(63 63 70)" strokeWidth="1" />
        <polyline points={polylineAttribute(chartPoints)} fill="none" stroke="rgb(52 211 153)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        {chartPoints.map((point, index) => (
          <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="1.8" fill="rgb(134 239 172)" />
        ))}
      </AccessibleChartSvg>
      <div className="flex justify-between text-[11px] text-zinc-500">
        <span>{money.format(domain.min)}</span>
        <span>{money.format(domain.max)}</span>
      </div>
    </ChartFrame>
  );
}

function DecisionLine({ decision }: { decision: OpportunityDecision }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium capitalize text-zinc-100">
          {decision.buyExchange} → {decision.sellExchange}
        </span>
        <Badge tone={decision.status === "accepted" ? "green" : "red"}>{money.format(decision.netProfitUsd)}</Badge>
      </div>
      <div className="mt-2 text-xs text-zinc-400">
        {decision.status === "accepted"
          ? decision.explanation
          : decision.rejectionReasons.join(" · ")}
      </div>
    </div>
  );
}

function adapterChannel(adapter: (typeof exchangeAdapters)[number]): string {
  const message = adapter.subscribeMessage;
  if (!message || typeof message !== "object") {
    return adapter.websocketUrl.includes("@") ? adapter.websocketUrl.split("/").at(-1) ?? "stream" : "implicit book stream";
  }
  const record = message as Record<string, unknown>;
  if (Array.isArray(record.args)) return record.args.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ");
  if (Array.isArray(record.channels)) return record.channels.join(", ");
  if (Array.isArray(record.payload)) return record.payload.join(", ");
  if (record.channel) return String(record.channel);
  return "public order book";
}

function sourceYieldFields(exchangeId: ExchangeId): string[] {
  const common = ["bid/ask levels", "L2 depth", "latency age", "quote lane"];
  const extras: Partial<Record<ExchangeId, string[]>> = {
    kraken: ["checksum", "exchange timestamp"],
    coinbase: ["l2update deltas", "product id"],
    gemini: ["socket sequence", "event reason"],
    binance: ["update id", "REST snapshot"],
    bybit: ["sequence", "cts timestamp"],
    gate: ["book id", "100ms cadence"],
    okx: ["books5 cadence", "seq id"],
    bitfinex: ["count removals", "signed amount side"],
    bitstamp: ["microtimestamp", "REST fallback"],
    kucoin: ["public token", "depth50", "sequence audit"],
    bitget: ["books50", "sequence audit", "depth cadence"],
  };
  return [...common, ...(extras[exchangeId] ?? [])];
}

function formatAge(timestamp?: number): string {
  if (!timestamp) return "no messages yet";
  const ageSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1_000));
  if (ageSeconds < 2) return "just now";
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  return `${Math.round(ageSeconds / 60)}m ago`;
}

function healthTone(status?: string): "green" | "red" | "amber" | "neutral" {
  if (status === "live") return "green";
  if (status === "error") return "red";
  if (status === "connecting" || status === "stale") return "amber";
  return "neutral";
}

function compactUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function formatPairPrice(pair: string, value: number): string {
  if (value <= 0) return "-";
  if (pair.endsWith("-USD")) return money.format(value);
  return value.toFixed(8);
}

function formatMexicoPrice(pair: string, value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (pair === "usd_mxn") return `${value.toFixed(4)} MXN/USD`;
  if (pair === "btc_mxn") return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} MXN`;
  return money.format(value);
}

function formatMexicoAmount(value: number, asset: "BTC" | "USD" | "MXN"): string {
  if (asset === "BTC") return `${btc.format(value)} BTC`;
  if (asset === "MXN") return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} MXN`;
  return money.format(value);
}

function formatAssetAmount(value: number, asset: "USD" | "BTC" | "ETH"): string {
  if (asset === "USD") return money.format(value);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(value)} ${asset}`;
}

function formatReceiptValue(value: number, unit: "USD" | "BTC" | "probability" | "score"): string {
  if (unit === "USD") return money.format(value);
  if (unit === "BTC") return `${btc.format(value)} BTC`;
  if (unit === "probability") return `${(value * 100).toFixed(1)}%`;
  return `${Math.round(value)}/100`;
}

function marketRegimeLabel(context: MarketContext): string {
  const vol = context.volatility.realizedVolBpsPerSecond;
  const sentiment = context.sentiment?.value ?? 50;
  if (vol >= 8 && sentiment >= 70) return "hot risk-on";
  if (vol >= 8 && sentiment <= 35) return "panic volatility";
  if (vol >= 5) return "fast market";
  if (sentiment >= 75) return "crowded greed";
  if (sentiment <= 25) return "risk-off fear";
  return "balanced";
}

import type { ExecutionRegimeFusion } from "./execution-regime";
import type { OpportunityHeatmap } from "./opportunity-heatmap";
import type { QueuePositionOracle } from "./queue-position";
import type { SettlementRiskOracle } from "./settlement-risk";
import type { SmartOrderRouterPlan } from "./smart-order-router";
import type { OpportunityDecision } from "./types";
import type { VenueFailureWarGame } from "./venue-failure";

export type ExecutionPlaybookActionId =
  | "smart-route"
  | "cross-now"
  | "post-maker"
  | "rebalance"
  | "wait-for-evidence"
  | "halt";

export type ExecutionPlaybookAction = {
  id: ExecutionPlaybookActionId;
  label: string;
  expectedPnlUsd: number;
  riskScore: number;
  confidence: number;
  actionScore: number;
  simulatedOnly: true;
  reasons: string[];
};

export type ExecutionPlaybook = {
  generatedAt: number;
  actions: ExecutionPlaybookAction[];
  summary: {
    recommendedAction: ExecutionPlaybookActionId;
    expectedPnlUsd: number;
    riskScore: number;
    confidence: number;
    hardStops: string[];
    explainabilityScore: number;
  };
  equation: string;
};

export function buildExecutionPlaybook(input: {
  decision?: OpportunityDecision;
  smartOrderRouter?: SmartOrderRouterPlan;
  queuePosition?: QueuePositionOracle;
  venueFailureWarGame?: VenueFailureWarGame;
  executionRegime?: ExecutionRegimeFusion;
  settlementRisk?: SettlementRiskOracle;
  opportunityHeatmap?: OpportunityHeatmap;
  observedAt?: number;
}): ExecutionPlaybook {
  const generatedAt = input.observedAt ?? Date.now();
  const hardStops = buildHardStops(input);
  const actions = [
    smartRouteAction(input),
    crossNowAction(input),
    postMakerAction(input),
    rebalanceAction(input),
    waitAction(input),
    haltAction(input, hardStops),
  ].map((action) => applyHardStop(action, hardStops));
  const ranked = actions.sort((a, b) => b.actionScore - a.actionScore || b.expectedPnlUsd - a.expectedPnlUsd);
  const recommended = ranked[0] ?? haltAction(input, ["no action candidates"]);

  return {
    generatedAt,
    actions: ranked,
    summary: {
      recommendedAction: recommended.id,
      expectedPnlUsd: recommended.expectedPnlUsd,
      riskScore: recommended.riskScore,
      confidence: recommended.confidence,
      hardStops,
      explainabilityScore: round(explainabilityScore(input)),
    },
    equation:
      "action_score = normalized_expected_pnl*0.38 + risk_score*0.27 + confidence*0.25 + explainability_bonus - hard_stop_penalty; recommended_action = max(action_score)",
  };
}

function smartRouteAction(input: Parameters<typeof buildExecutionPlaybook>[0]): ExecutionPlaybookAction {
  const router = input.smartOrderRouter;
  const executable = router && ["split-route", "single-route", "cap-size"].includes(router.summary.policy) && router.summary.netProfitUsd > 0;
  const riskScore = router?.summary.policy === "split-route" ? 82 : router?.summary.policy === "cap-size" ? 58 : 70;
  const confidence = router ? clampScore(52 + router.summary.sourceCount * 4 + Math.min(18, router.summary.venuesUsed * 4)) : 0;
  const reasons = [
    ...(router?.summary.policy === "split-route" ? ["multi-venue route improves over single route"] : []),
    ...(router && router.summary.improvementUsd > 0 ? [`improves single route by ${money(router.summary.improvementUsd)}`] : []),
    ...(router?.rejectionReasons ?? []),
  ];
  return buildAction({
    id: "smart-route",
    label: "Smart-route across venues",
    expectedPnlUsd: executable ? router.summary.netProfitUsd : 0,
    riskScore: executable ? riskScore : 15,
    confidence: executable ? confidence : 10,
    reasons: reasons.length ? reasons : ["waiting for smart router edge"],
  });
}

function crossNowAction(input: Parameters<typeof buildExecutionPlaybook>[0]): ExecutionPlaybookAction {
  const decision = input.decision;
  const executable = decision?.status === "accepted" && decision.netProfitUsd > 0;
  const regimePenalty = input.executionRegime?.action === "cap-size" ? 12 : input.executionRegime?.action === "wait-for-evidence" ? 22 : 0;
  return buildAction({
    id: "cross-now",
    label: "Cross spread now",
    expectedPnlUsd: executable ? decision.netProfitUsd : 0,
    riskScore: executable ? clampScore((decision.risk.score ?? 50) - regimePenalty) : 12,
    confidence: executable ? clampScore(decision.risk.positivePnlProbability * 100) : 8,
    reasons: executable ? ["accepted live/replay route", ...decision.risk.reasons.slice(0, 2)] : ["no accepted taker route"],
  });
}

function postMakerAction(input: Parameters<typeof buildExecutionPlaybook>[0]): ExecutionPlaybookAction {
  const queue = input.queuePosition;
  const makerBetter = queue && queue.summary.expectedMakerNetUsd > queue.summary.takerNetUsd;
  return buildAction({
    id: "post-maker",
    label: "Post maker orders",
    expectedPnlUsd: makerBetter ? queue.summary.expectedMakerNetUsd : 0,
    riskScore: makerBetter ? clampScore(42 + queue.summary.combinedFillProbability * 44 - queue.summary.toxicFlowPenaltyUsd * 0.35) : 18,
    confidence: makerBetter ? clampScore(queue.summary.combinedFillProbability * 100) : 12,
    reasons: makerBetter
      ? [`maker EV improves taker by ${money(queue.summary.expectedImprovementUsd)}`, `fill probability ${(queue.summary.combinedFillProbability * 100).toFixed(1)}%`]
      : ["maker queue economics do not beat taker execution"],
  });
}

function rebalanceAction(input: Parameters<typeof buildExecutionPlaybook>[0]): ExecutionPlaybookAction {
  const settlement = input.settlementRisk;
  const policy = settlement?.summary.policy;
  const allowed = policy === "rebalance-now" || policy === "batch-rebalance";
  const penalty = settlement?.summary.settlementPenaltyBps ?? 0;
  return buildAction({
    id: "rebalance",
    label: "Rebalance simulated inventory",
    expectedPnlUsd: allowed ? -Math.max(1, settlement?.summary.fastestFeeUsd ?? 2) : 0,
    riskScore: allowed ? clampScore(72 - penalty) : 22,
    confidence: settlement ? 72 : 10,
    reasons: settlement ? [`settlement policy ${policy}`, `stranding risk ${settlement.summary.strandingRiskScore}/100`] : ["settlement oracle missing"],
  });
}

function waitAction(input: Parameters<typeof buildExecutionPlaybook>[0]): ExecutionPlaybookAction {
  const heatmap = input.opportunityHeatmap;
  const regimeWait = input.executionRegime?.action === "wait-for-evidence";
  const pattern = heatmap?.summary.policy === "pattern-detected";
  return buildAction({
    id: "wait-for-evidence",
    label: "Wait for stronger evidence",
    expectedPnlUsd: 0,
    riskScore: regimeWait ? 78 : pattern ? 62 : 48,
    confidence: heatmap ? clampScore(40 + heatmap.summary.concentrationScore * 0.45) : 35,
    reasons: [
      ...(regimeWait ? ["execution regime requests more evidence"] : []),
      ...(pattern ? [`historical hot hour ${heatmap?.summary.hotHourUtc}:00 UTC`] : ["no strong historical cluster currently driving wait"]),
    ],
  });
}

function haltAction(input: Parameters<typeof buildExecutionPlaybook>[0], hardStops: string[]): ExecutionPlaybookAction {
  return buildAction({
    id: "halt",
    label: "Halt simulated execution",
    expectedPnlUsd: 0,
    riskScore: hardStops.length ? 10 : 35,
    confidence: hardStops.length ? 95 : 28,
    reasons: hardStops.length ? hardStops : ["no hard stop active"],
    forceScore: hardStops.length ? 100 : undefined,
  });
}

function buildHardStops(input: Parameters<typeof buildExecutionPlaybook>[0]): string[] {
  return [
    ...(input.executionRegime?.action === "halt" ? ["execution regime halt"] : []),
    ...(input.venueFailureWarGame?.summary.policy === "halt-route" ? ["venue failure halt-route"] : []),
    ...(input.settlementRisk?.summary.policy === "halt-withdrawals" ? ["settlement halt-withdrawals"] : []),
  ];
}

function applyHardStop(action: ExecutionPlaybookAction, hardStops: string[]): ExecutionPlaybookAction {
  if (hardStops.length === 0 || action.id === "halt") return action;
  return {
    ...action,
    actionScore: Math.max(0, action.actionScore - 55),
    riskScore: Math.min(action.riskScore, 35),
    reasons: [...action.reasons, "hard stop suppresses this action"],
  };
}

function buildAction(input: {
  id: ExecutionPlaybookActionId;
  label: string;
  expectedPnlUsd: number;
  riskScore: number;
  confidence: number;
  reasons: string[];
  forceScore?: number;
}): ExecutionPlaybookAction {
  const pnlScore = clampScore(50 + input.expectedPnlUsd * 1.4);
  const actionScore = input.forceScore ?? clampScore(pnlScore * 0.38 + input.riskScore * 0.27 + input.confidence * 0.25 + Math.min(10, input.reasons.length * 2));
  return {
    id: input.id,
    label: input.label,
    expectedPnlUsd: round(input.expectedPnlUsd),
    riskScore: clampScore(input.riskScore),
    confidence: clampScore(input.confidence),
    actionScore,
    simulatedOnly: true,
    reasons: input.reasons,
  };
}

function explainabilityScore(input: Parameters<typeof buildExecutionPlaybook>[0]): number {
  return [
    input.decision,
    input.smartOrderRouter,
    input.queuePosition,
    input.venueFailureWarGame,
    input.executionRegime,
    input.settlementRisk,
    input.opportunityHeatmap,
  ].filter(Boolean).length * 14;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function money(value: number): string {
  return `$${round(value).toFixed(2)}`;
}

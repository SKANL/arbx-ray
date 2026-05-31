import type { EdgeConviction } from "./edge-conviction";
import type { ExecutionPlaybook, ExecutionPlaybookActionId } from "./execution-playbook";
import type { LatencyAlphaRace } from "./latency-alpha-race";
import type { RiskGovernor } from "./risk-governor";
import type { OpportunityDecision } from "./types";
import type { WalkForwardRobustness } from "./walk-forward";

export type CausalEvidenceGroup = "market" | "validation" | "execution" | "risk" | "decision";
export type CausalEvidenceState = "support" | "drag" | "blocker" | "missing";
export type CausalExecutionFinalDecision = "execute-simulated" | "cap-size" | "wait-for-evidence" | "halt-simulated";

export type CausalExecutionNode = {
  id: string;
  label: string;
  group: CausalEvidenceGroup;
  state: CausalEvidenceState;
  score: number;
  evidence: string;
};

export type CausalExecutionEdge = {
  from: string;
  to: string;
  weight: number;
  label: string;
};

export type CausalExecutionGraph = {
  generatedAt: number;
  nodes: CausalExecutionNode[];
  edges: CausalExecutionEdge[];
  rejectionReasons: string[];
  summary: {
    finalDecision: CausalExecutionFinalDecision;
    supportScore: number;
    dragScore: number;
    blockerCount: number;
    weakestLink?: CausalExecutionNode;
    explanation: string;
  };
  equation: string;
};

export function buildCausalExecutionGraph(input: {
  decision?: OpportunityDecision;
  governor?: RiskGovernor;
  edgeConviction?: EdgeConviction;
  latencyAlphaRace?: LatencyAlphaRace;
  walkForwardRobustness?: WalkForwardRobustness;
  executionPlaybook?: ExecutionPlaybook;
  observedAt?: number;
}): CausalExecutionGraph {
  const generatedAt = input.observedAt ?? Date.now();
  const evidenceNodes = [
    marketEdgeNode(input.decision),
    edgeConvictionNode(input.edgeConviction),
    walkForwardNode(input.walkForwardRobustness),
    latencyRaceNode(input.latencyAlphaRace),
    riskGovernorNode(input.governor),
    executionPlaybookNode(input.executionPlaybook),
  ];
  const supportScore = scoreSupport(evidenceNodes);
  const dragScore = scoreDrag(evidenceNodes);
  const blockerCount = evidenceNodes.filter((node) => node.state === "blocker").length;
  const finalDecision = chooseDecision({ nodes: evidenceNodes, supportScore, dragScore, blockerCount });
  const finalNode = finalDecisionNode({ finalDecision, supportScore, dragScore, blockerCount });
  const nodes = [...evidenceNodes, finalNode];
  const rejectionReasons = rejectionReasonsFrom(nodes, input.decision);
  const weakestLink = weakestLinkFrom(evidenceNodes);

  return {
    generatedAt,
    nodes,
    edges: [
      edge("market-edge", "edge-conviction", 0.78, "route economics inform posterior"),
      edge("market-edge", "latency-race", 0.72, "net edge decays under speed race"),
      edge("walk-forward", "edge-conviction", 0.64, "out-of-sample proof adjusts belief"),
      edge("latency-race", "execution-playbook", 0.82, "survival probability gates action"),
      edge("risk-governor", "execution-playbook", 0.88, "hard stops suppress actions"),
      edge("edge-conviction", "final-decision", 0.74, "probabilistic evidence"),
      edge("walk-forward", "final-decision", 0.7, "overfit control"),
      edge("execution-playbook", "final-decision", 0.9, "ranked autonomous action"),
      edge("risk-governor", "final-decision", 0.94, "circuit breaker authority"),
    ],
    rejectionReasons,
    summary: {
      finalDecision,
      supportScore,
      dragScore,
      blockerCount,
      weakestLink,
      explanation: explanation({ finalDecision, supportScore, dragScore, blockerCount, weakestLink }),
    },
    equation:
      "decision_score = support_score - drag_score - blocker_count*35; final_decision = halt if blockers > 0 else execute/cap/wait by decision_score",
  };
}

function marketEdgeNode(decision: OpportunityDecision | undefined): CausalExecutionNode {
  if (!decision) {
    return node("market-edge", "Market edge", "market", "missing", 0, "waiting for a live or replay opportunity");
  }
  if (decision.status === "rejected") {
    return node("market-edge", "Market edge", "market", "blocker", 8, decision.rejectionReasons.join("; ") || "route rejected");
  }
  const notional = Math.max(decision.buyFill.notional, decision.sellFill.notional);
  const netEdgeBps = notional > 0 ? (decision.netProfitUsd / notional) * 10_000 : 0;
  const score = clampScore(42 + netEdgeBps * 2.2 + decision.risk.positivePnlProbability * 22 + decision.risk.score * 0.18);
  return node(
    "market-edge",
    "Market edge",
    "market",
    score >= 55 ? "support" : "drag",
    score,
    `net ${money(decision.netProfitUsd)}, edge ${round(netEdgeBps, 2)} bps, P(win) ${(decision.risk.positivePnlProbability * 100).toFixed(1)}%`,
  );
}

function edgeConvictionNode(conviction: EdgeConviction | undefined): CausalExecutionNode {
  if (!conviction) return node("edge-conviction", "Bayesian conviction", "validation", "missing", 0, "posterior not loaded");
  const score = clampScore(conviction.posteriorProbability * 72 + conviction.evidenceScore * 0.28);
  const state =
    conviction.recommendation === "reject"
      ? "blocker"
      : conviction.recommendation === "wait-for-evidence"
        ? "drag"
        : conviction.recommendation === "cap-size"
          ? "drag"
          : "support";
  return node(
    "edge-conviction",
    "Bayesian conviction",
    "validation",
    state,
    score,
    `${conviction.recommendation}; posterior ${(conviction.posteriorProbability * 100).toFixed(1)}%, evidence ${conviction.evidenceScore}/100`,
  );
}

function walkForwardNode(lab: WalkForwardRobustness | undefined): CausalExecutionNode {
  if (!lab) return node("walk-forward", "Walk-forward validation", "validation", "missing", 0, "walk-forward lab not loaded");
  const state =
    lab.summary.policy === "reject-overfit"
      ? "blocker"
      : lab.summary.policy === "insufficient-history"
        ? "missing"
        : lab.summary.policy === "cap-size"
          ? "drag"
          : "support";
  const score = clampScore(lab.summary.generalizationRatio * 82 + Math.max(0, 18 - lab.summary.overfitPenalty * 0.18));
  return node(
    "walk-forward",
    "Walk-forward validation",
    "validation",
    state,
    score,
    `${lab.summary.policy}; generalization ${(lab.summary.generalizationRatio * 100).toFixed(1)}%, OOS ${money(lab.summary.outOfSamplePnlUsd)}`,
  );
}

function latencyRaceNode(race: LatencyAlphaRace | undefined): CausalExecutionNode {
  if (!race || race.summary.edgeHalfLifeMs <= 0) {
    return node("latency-race", "Latency alpha race", "execution", "missing", 0, "latency race not loaded");
  }
  const state =
    race.summary.policy === "reject-race-lost"
      ? "blocker"
      : race.summary.policy === "wait-for-edge"
        ? "drag"
        : race.summary.policy === "cap-size"
          ? "drag"
          : "support";
  const score = clampScore(race.summary.raceScore * 0.72 + race.summary.survivalProbability * 28);
  return node(
    "latency-race",
    "Latency alpha race",
    "execution",
    state,
    score,
    `${race.summary.policy}; survival ${(race.summary.survivalProbability * 100).toFixed(1)}%, capture ${money(race.summary.expectedCaptureUsd)}; ${race.reasons[0] ?? "latency evidence"}`,
  );
}

function riskGovernorNode(governor: RiskGovernor | undefined): CausalExecutionNode {
  if (!governor) return node("risk-governor", "Risk governor", "risk", "missing", 0, "risk governor not loaded");
  const state = governor.state === "halt" ? "blocker" : governor.state === "caution" ? "drag" : "support";
  return node("risk-governor", "Risk governor", "risk", state, governor.score, `${governor.state}; ${governor.action}`);
}

function executionPlaybookNode(playbook: ExecutionPlaybook | undefined): CausalExecutionNode {
  if (!playbook) return node("execution-playbook", "Autonomous playbook", "decision", "missing", 0, "execution playbook not loaded");
  const action = playbook.summary.recommendedAction;
  const state = action === "halt" ? "blocker" : action === "wait-for-evidence" ? "drag" : isDefensiveAction(action) ? "drag" : "support";
  const score = clampScore(playbook.actions[0]?.actionScore ?? playbook.summary.confidence);
  const stops = playbook.summary.hardStops.length ? `; hard stops ${playbook.summary.hardStops.join(", ")}` : "";
  return node(
    "execution-playbook",
    "Autonomous playbook",
    "decision",
    state,
    score,
    `${action}; expected ${money(playbook.summary.expectedPnlUsd)}, confidence ${playbook.summary.confidence}/100${stops}`,
  );
}

function finalDecisionNode(input: {
  finalDecision: CausalExecutionFinalDecision;
  supportScore: number;
  dragScore: number;
  blockerCount: number;
}): CausalExecutionNode {
  const score = clampScore(input.supportScore - input.dragScore - input.blockerCount * 35);
  const state: CausalEvidenceState =
    input.finalDecision === "halt-simulated"
      ? "blocker"
      : input.finalDecision === "wait-for-evidence"
        ? "missing"
        : input.finalDecision === "cap-size"
          ? "drag"
          : "support";
  return node("final-decision", "Final simulated decision", "decision", state, score, input.finalDecision);
}

function chooseDecision(input: {
  nodes: CausalExecutionNode[];
  supportScore: number;
  dragScore: number;
  blockerCount: number;
}): CausalExecutionFinalDecision {
  if (input.blockerCount > 0) return "halt-simulated";
  const missingCount = input.nodes.filter((node) => node.state === "missing").length;
  const decisionScore = input.supportScore - input.dragScore;
  if (missingCount >= 3 || decisionScore < 15) return "wait-for-evidence";
  if (input.nodes.some((node) => node.state === "drag") || decisionScore < 58) return "cap-size";
  return "execute-simulated";
}

function scoreSupport(nodes: CausalExecutionNode[]): number {
  const supporting = nodes.filter((node) => node.state === "support");
  if (!supporting.length) return 0;
  return round(supporting.reduce((sum, node) => sum + node.score, 0) / supporting.length);
}

function scoreDrag(nodes: CausalExecutionNode[]): number {
  return round(
    nodes.reduce((sum, node) => {
      if (node.state === "blocker") return sum + Math.max(42, 100 - node.score);
      if (node.state === "drag") return sum + Math.max(18, 100 - node.score);
      if (node.state === "missing") return sum + 12;
      return sum;
    }, 0),
  );
}

function weakestLinkFrom(nodes: CausalExecutionNode[]): CausalExecutionNode | undefined {
  return [...nodes].sort((a, b) => stateSeverity(b.state) - stateSeverity(a.state) || a.score - b.score)[0];
}

function rejectionReasonsFrom(nodes: CausalExecutionNode[], decision: OpportunityDecision | undefined): string[] {
  const causalReasons = nodes
    .filter((node) => node.state === "blocker" || node.state === "drag")
    .filter((node) => node.id !== "final-decision")
    .map((node) => `${node.label}: ${node.evidence}`);
  return [...new Set([...(decision?.rejectionReasons ?? []), ...causalReasons])];
}

function explanation(input: {
  finalDecision: CausalExecutionFinalDecision;
  supportScore: number;
  dragScore: number;
  blockerCount: number;
  weakestLink?: CausalExecutionNode;
}): string {
  const weakest = input.weakestLink ? ` weakest link: ${input.weakestLink.label} (${input.weakestLink.state}).` : "";
  if (input.blockerCount > 0) {
    return `${input.finalDecision}: ${input.blockerCount} blocker(s) override support score ${input.supportScore}/100.${weakest}`;
  }
  return `${input.finalDecision}: support ${input.supportScore}/100 versus drag ${input.dragScore}/100.${weakest}`;
}

function isDefensiveAction(action: ExecutionPlaybookActionId): boolean {
  return action === "rebalance";
}

function node(
  id: string,
  label: string,
  group: CausalEvidenceGroup,
  state: CausalEvidenceState,
  score: number,
  evidence: string,
): CausalExecutionNode {
  return { id, label, group, state, score: clampScore(score), evidence };
}

function edge(from: string, to: string, weight: number, label: string): CausalExecutionEdge {
  return { from, to, weight: round(weight, 2), label };
}

function stateSeverity(state: CausalEvidenceState): number {
  if (state === "blocker") return 4;
  if (state === "drag") return 3;
  if (state === "missing") return 2;
  return 1;
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

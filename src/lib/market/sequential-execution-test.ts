import type { CausalExecutionGraph } from "./causal-execution-graph";
import type { EdgeConviction } from "./edge-conviction";
import type { HawkesFlowShockOracle } from "./hawkes-flow";
import type { LatencyAlphaRace } from "./latency-alpha-race";
import type { LiquidityMirageDetector } from "./liquidity-mirage";
import type { RiskGovernor } from "./risk-governor";
import type { OpportunityDecision } from "./types";
import type { WalkForwardRobustness } from "./walk-forward";

export type SequentialExecutionDecision =
  | "accept-execute"
  | "accept-cap-size"
  | "continue-sampling"
  | "reject-execution";

export type SequentialEvidenceDirection = "supports-execution" | "supports-rejection" | "neutral";

export type SequentialEvidenceStep = {
  id: string;
  label: string;
  logLikelihood: number;
  cumulativeLogLikelihood: number;
  direction: SequentialEvidenceDirection;
  evidence: string;
};

export type SequentialExecutionTest = {
  generatedAt: number;
  alpha: number;
  beta: number;
  upperBoundary: number;
  lowerBoundary: number;
  steps: SequentialEvidenceStep[];
  summary: {
    decision: SequentialExecutionDecision;
    finalLogLikelihood: number;
    confidencePct: number;
    falseExecuteRiskPct: number;
    falseRejectRiskPct: number;
    evidenceCount: number;
    strongestSupport?: string;
    strongestRejection?: string;
  };
  reasons: string[];
  equation: string;
};

export function buildSequentialExecutionTest(input: {
  decision?: OpportunityDecision;
  edgeConviction?: EdgeConviction;
  latencyAlphaRace?: LatencyAlphaRace;
  hawkesFlowShock?: HawkesFlowShockOracle;
  liquidityMirage?: LiquidityMirageDetector;
  riskGovernor?: RiskGovernor;
  walkForwardRobustness?: WalkForwardRobustness;
  causalExecutionGraph?: CausalExecutionGraph;
  alpha?: number;
  beta?: number;
  observedAt?: number;
}): SequentialExecutionTest {
  const generatedAt = input.observedAt ?? Date.now();
  const alpha = clamp(input.alpha ?? 0.08, 0.001, 0.49);
  const beta = clamp(input.beta ?? 0.12, 0.001, 0.49);
  const upperBoundary = round(Math.log((1 - beta) / alpha), 4);
  const lowerBoundary = round(Math.log(beta / (1 - alpha)), 4);
  const rawSteps = [
    decisionStep(input.decision),
    edgeConvictionStep(input.edgeConviction),
    latencyStep(input.latencyAlphaRace),
    hawkesStep(input.hawkesFlowShock),
    liquidityMirageStep(input.liquidityMirage),
    riskGovernorStep(input.riskGovernor),
    walkForwardStep(input.walkForwardRobustness),
    causalGraphStep(input.causalExecutionGraph),
  ];
  let cumulative = 0;
  const steps = rawSteps.map((step) => {
    cumulative = round(cumulative + step.logLikelihood, 4);
    return {
      ...step,
      logLikelihood: round(step.logLikelihood, 4),
      cumulativeLogLikelihood: cumulative,
      direction: direction(step.logLikelihood),
    };
  });
  const finalLogLikelihood = round(cumulative, 4);
  const hardBlockers = hardBlockersFrom(input);
  const capRequired = capRequiredFrom(input);
  const decision = chooseDecision({ finalLogLikelihood, upperBoundary, lowerBoundary, hardBlockers, capRequired });
  const strongestSupport = strongest(steps, "supports-execution");
  const strongestRejection = strongest(steps, "supports-rejection");
  const reasons = reasonsFrom({
    decision,
    finalLogLikelihood,
    upperBoundary,
    lowerBoundary,
    hardBlockers,
    capRequired,
    strongestSupport,
    strongestRejection,
  });

  return {
    generatedAt,
    alpha,
    beta,
    upperBoundary,
    lowerBoundary,
    steps,
    summary: {
      decision,
      finalLogLikelihood,
      confidencePct: round(sigmoid(finalLogLikelihood) * 100, 1),
      falseExecuteRiskPct: round(alpha * 100, 1),
      falseRejectRiskPct: round(beta * 100, 1),
      evidenceCount: steps.filter((step) => step.direction !== "neutral").length,
      strongestSupport,
      strongestRejection,
    },
    reasons,
    equation:
      "SPRT: log_likelihood_ratio = sum(log(P(evidence|H1_executable)/P(evidence|H0_not_executable))); upper_boundary = ln((1-beta)/alpha); lower_boundary = ln(beta/(1-alpha))",
  };
}

function decisionStep(decision: OpportunityDecision | undefined): Omit<SequentialEvidenceStep, "cumulativeLogLikelihood" | "direction"> {
  if (!decision) {
    return {
      id: "market-decision",
      label: "Base execution decision",
      logLikelihood: -0.75,
      evidence: "No live or replay opportunity is available, so the sequential test waits.",
    };
  }
  if (decision.status !== "accepted") {
    return {
      id: "market-decision",
      label: "Base execution decision",
      logLikelihood: -2.15,
      evidence: decision.rejectionReasons.join("; ") || "Base simulator rejected the route.",
    };
  }
  const notional = Math.max(decision.buyFill.notional, decision.sellFill.notional);
  const edgeBps = notional > 0 ? (decision.netProfitUsd / notional) * 10_000 : 0;
  const probabilityWeight = logit(clamp(decision.risk.positivePnlProbability, 0.001, 0.999)) - logit(0.58);
  const edgeWeight = clamp(edgeBps / 90, -0.6, 0.85);
  return {
    id: "market-decision",
    label: "Base execution decision",
    logLikelihood: probabilityWeight + edgeWeight,
    evidence: `Accepted route; P(win) ${(decision.risk.positivePnlProbability * 100).toFixed(1)}%, net ${money(decision.netProfitUsd)}, edge ${round(edgeBps)} bps.`,
  };
}

function edgeConvictionStep(
  conviction: EdgeConviction | undefined,
): Omit<SequentialEvidenceStep, "cumulativeLogLikelihood" | "direction"> {
  if (!conviction) {
    return {
      id: "edge-conviction",
      label: "Bayesian edge conviction",
      logLikelihood: -0.25,
      evidence: "Bayesian conviction is not available.",
    };
  }
  const recommendationWeight =
    conviction.recommendation === "simulate-execute"
      ? 0.35
      : conviction.recommendation === "cap-size"
        ? -0.08
        : conviction.recommendation === "reject"
          ? -0.62
          : -0.25;
  const posteriorWeight = (logit(clamp(conviction.posteriorProbability, 0.001, 0.999)) - logit(0.65)) * 0.58;
  return {
    id: "edge-conviction",
    label: "Bayesian edge conviction",
    logLikelihood: posteriorWeight + recommendationWeight,
    evidence: `${conviction.recommendation}; posterior ${(conviction.posteriorProbability * 100).toFixed(1)}%, evidence score ${conviction.evidenceScore}/100.`,
  };
}

function latencyStep(race: LatencyAlphaRace | undefined): Omit<SequentialEvidenceStep, "cumulativeLogLikelihood" | "direction"> {
  if (!race) {
    return {
      id: "latency-race",
      label: "Latency alpha race",
      logLikelihood: -0.2,
      evidence: "Latency race evidence is not available.",
    };
  }
  const policyWeight =
    race.summary.policy === "cross-now"
      ? 0.58
      : race.summary.policy === "cap-size"
        ? -0.28
        : race.summary.policy === "reject-race-lost"
          ? -1.45
          : -0.48;
  const survivalWeight = (logit(clamp(race.summary.survivalProbability, 0.001, 0.999)) - logit(0.55)) * 0.5;
  const captureWeight = clamp(race.summary.expectedCaptureUsd / 170, -0.65, 0.75);
  const scoreWeight = clamp((race.summary.raceScore - 58) / 95, -0.55, 0.45);
  return {
    id: "latency-race",
    label: "Latency alpha race",
    logLikelihood: policyWeight + survivalWeight + captureWeight + scoreWeight,
    evidence: `${race.summary.policy}; survival ${(race.summary.survivalProbability * 100).toFixed(1)}%, expected capture ${money(race.summary.expectedCaptureUsd)}.`,
  };
}

function hawkesStep(
  oracle: HawkesFlowShockOracle | undefined,
): Omit<SequentialEvidenceStep, "cumulativeLogLikelihood" | "direction"> {
  if (!oracle) {
    return {
      id: "hawkes-flow",
      label: "Hawkes flow shock",
      logLikelihood: -0.12,
      evidence: "Self-exciting flow evidence is not available.",
    };
  }
  const policyWeight =
    oracle.summary.policy === "allow"
      ? 0.36
      : oracle.summary.policy === "cap-size"
        ? -0.22
        : oracle.summary.policy === "wait-for-calm"
          ? -0.55
          : -1.75;
  const aftershockWeight = clamp((0.45 - oracle.summary.aftershockProbability) * 1.2, -0.65, 0.35);
  const branchingWeight = clamp((0.55 - oracle.summary.branchingRatio) * 0.8, -0.45, 0.3);
  return {
    id: "hawkes-flow",
    label: "Hawkes flow shock",
    logLikelihood: policyWeight + aftershockWeight + branchingWeight,
    evidence: `${oracle.summary.policy}; branching ${oracle.summary.branchingRatio.toFixed(2)}, aftershock ${(oracle.summary.aftershockProbability * 100).toFixed(1)}%.`,
  };
}

function liquidityMirageStep(
  detector: LiquidityMirageDetector | undefined,
): Omit<SequentialEvidenceStep, "cumulativeLogLikelihood" | "direction"> {
  if (!detector) {
    return {
      id: "liquidity-mirage",
      label: "Liquidity mirage detector",
      logLikelihood: -0.18,
      evidence: "Depth mirage evidence is not available.",
    };
  }
  const policyWeight =
    detector.summary.policy === "allow"
      ? 0.46
      : detector.summary.policy === "cap-size"
        ? -0.22
        : detector.summary.policy === "wait-for-depth"
          ? -0.42
          : -1.85;
  const mirageWeight = clamp((45 - detector.summary.mirageScore) / 80, -0.72, 0.38);
  const retentionWeight = clamp((detector.summary.executableEdgeRetainedPct - 70) / 120, -0.5, 0.35);
  return {
    id: "liquidity-mirage",
    label: "Liquidity mirage detector",
    logLikelihood: policyWeight + mirageWeight + retentionWeight,
    evidence: `${detector.summary.policy}; mirage score ${detector.summary.mirageScore}/100, retained edge ${detector.summary.executableEdgeRetainedPct.toFixed(1)}%.`,
  };
}

function riskGovernorStep(
  governor: RiskGovernor | undefined,
): Omit<SequentialEvidenceStep, "cumulativeLogLikelihood" | "direction"> {
  if (!governor) {
    return {
      id: "risk-governor",
      label: "Risk governor",
      logLikelihood: -0.3,
      evidence: "Risk governor is not available.",
    };
  }
  const stateWeight = governor.state === "normal" ? 0.62 : governor.state === "caution" ? -0.28 : -2.1;
  const scoreWeight = clamp((governor.score - 70) / 90, -0.55, 0.4);
  return {
    id: "risk-governor",
    label: "Risk governor",
    logLikelihood: stateWeight + scoreWeight,
    evidence: `${governor.state}; score ${governor.score}/100. ${governor.action}`,
  };
}

function walkForwardStep(
  lab: WalkForwardRobustness | undefined,
): Omit<SequentialEvidenceStep, "cumulativeLogLikelihood" | "direction"> {
  if (!lab) {
    return {
      id: "walk-forward",
      label: "Walk-forward robustness",
      logLikelihood: -0.22,
      evidence: "Walk-forward evidence is not available.",
    };
  }
  const policyWeight =
    lab.summary.policy === "deploy"
      ? 0.48
      : lab.summary.policy === "cap-size"
        ? -0.18
        : lab.summary.policy === "reject-overfit"
          ? -1.55
          : -0.52;
  const generalizationWeight = clamp((lab.summary.generalizationRatio - 0.55) * 1.1, -0.55, 0.42);
  const pnlWeight = clamp(lab.summary.outOfSamplePnlUsd / 240, -0.55, 0.35);
  return {
    id: "walk-forward",
    label: "Walk-forward robustness",
    logLikelihood: policyWeight + generalizationWeight + pnlWeight,
    evidence: `${lab.summary.policy}; generalization ${(lab.summary.generalizationRatio * 100).toFixed(1)}%, out-of-sample P&L ${money(lab.summary.outOfSamplePnlUsd)}.`,
  };
}

function causalGraphStep(
  graph: CausalExecutionGraph | undefined,
): Omit<SequentialEvidenceStep, "cumulativeLogLikelihood" | "direction"> {
  if (!graph) {
    return {
      id: "causal-graph",
      label: "Causal execution graph",
      logLikelihood: -0.2,
      evidence: "Causal graph evidence is not available.",
    };
  }
  const decisionWeight =
    graph.summary.finalDecision === "execute-simulated"
      ? 0.55
      : graph.summary.finalDecision === "cap-size"
        ? -0.1
        : graph.summary.finalDecision === "halt-simulated"
          ? -1.6
          : -0.42;
  const scoreWeight = clamp((graph.summary.supportScore - graph.summary.dragScore) / 110, -0.65, 0.55);
  const blockerWeight = -Math.min(1.2, graph.summary.blockerCount * 0.32);
  return {
    id: "causal-graph",
    label: "Causal execution graph",
    logLikelihood: decisionWeight + scoreWeight + blockerWeight,
    evidence: `${graph.summary.finalDecision}; support ${graph.summary.supportScore}, drag ${graph.summary.dragScore}, blockers ${graph.summary.blockerCount}.`,
  };
}

function hardBlockersFrom(input: {
  decision?: OpportunityDecision;
  edgeConviction?: EdgeConviction;
  latencyAlphaRace?: LatencyAlphaRace;
  hawkesFlowShock?: HawkesFlowShockOracle;
  liquidityMirage?: LiquidityMirageDetector;
  riskGovernor?: RiskGovernor;
  walkForwardRobustness?: WalkForwardRobustness;
  causalExecutionGraph?: CausalExecutionGraph;
}): string[] {
  const blockers: string[] = [];
  if (input.decision?.status === "rejected") blockers.push("base execution rejected");
  if (input.edgeConviction?.recommendation === "reject") blockers.push("Bayesian conviction rejects edge");
  if (input.latencyAlphaRace?.summary.policy === "reject-race-lost") blockers.push("latency race lost");
  if (input.hawkesFlowShock?.summary.policy === "halt-shock") blockers.push("Hawkes flow shock halt");
  if (input.liquidityMirage?.summary.policy === "halt-mirage") blockers.push("liquidity mirage halt");
  if (input.riskGovernor?.state === "halt") blockers.push("risk governor halt");
  if (input.walkForwardRobustness?.summary.policy === "reject-overfit") blockers.push("walk-forward overfit rejection");
  if (input.causalExecutionGraph?.summary.finalDecision === "halt-simulated") blockers.push("causal graph halt");
  return blockers;
}

function capRequiredFrom(input: {
  edgeConviction?: EdgeConviction;
  latencyAlphaRace?: LatencyAlphaRace;
  hawkesFlowShock?: HawkesFlowShockOracle;
  liquidityMirage?: LiquidityMirageDetector;
  riskGovernor?: RiskGovernor;
  walkForwardRobustness?: WalkForwardRobustness;
  causalExecutionGraph?: CausalExecutionGraph;
}): boolean {
  return (
    input.edgeConviction?.recommendation === "cap-size" ||
    input.latencyAlphaRace?.summary.policy === "cap-size" ||
    input.hawkesFlowShock?.summary.policy === "cap-size" ||
    input.liquidityMirage?.summary.policy === "cap-size" ||
    input.riskGovernor?.state === "caution" ||
    input.walkForwardRobustness?.summary.policy === "cap-size" ||
    input.causalExecutionGraph?.summary.finalDecision === "cap-size"
  );
}

function chooseDecision(input: {
  finalLogLikelihood: number;
  upperBoundary: number;
  lowerBoundary: number;
  hardBlockers: string[];
  capRequired: boolean;
}): SequentialExecutionDecision {
  if (input.hardBlockers.length > 0 || input.finalLogLikelihood <= input.lowerBoundary) return "reject-execution";
  if (input.capRequired && input.finalLogLikelihood > 0) return "accept-cap-size";
  if (input.finalLogLikelihood >= input.upperBoundary) return "accept-execute";
  return "continue-sampling";
}

function reasonsFrom(input: {
  decision: SequentialExecutionDecision;
  finalLogLikelihood: number;
  upperBoundary: number;
  lowerBoundary: number;
  hardBlockers: string[];
  capRequired: boolean;
  strongestSupport?: string;
  strongestRejection?: string;
}): string[] {
  const reasons =
    input.hardBlockers.length > 0
      ? [`hard blocker overrides SPRT boundary: ${input.hardBlockers.join("; ")}`]
      : [
          input.finalLogLikelihood >= input.upperBoundary
            ? `SPRT upper boundary crossed at ${input.finalLogLikelihood.toFixed(2)} >= ${input.upperBoundary.toFixed(2)}`
            : input.finalLogLikelihood <= input.lowerBoundary
              ? `SPRT lower boundary crossed at ${input.finalLogLikelihood.toFixed(2)} <= ${input.lowerBoundary.toFixed(2)}`
              : `SPRT remains between boundaries at ${input.finalLogLikelihood.toFixed(2)}`,
        ];
  if (input.hardBlockers.length > 0 && input.finalLogLikelihood <= input.lowerBoundary) {
    reasons.push(`SPRT lower boundary crossed at ${input.finalLogLikelihood.toFixed(2)} <= ${input.lowerBoundary.toFixed(2)}`);
  }
  if (input.capRequired && input.decision === "accept-cap-size") reasons.push("positive evidence accepted with capped simulated sizing");
  if (input.strongestSupport) reasons.push(`strongest support: ${input.strongestSupport}`);
  if (input.strongestRejection) reasons.push(`strongest rejection: ${input.strongestRejection}`);
  return reasons;
}

function strongest(steps: SequentialEvidenceStep[], directionValue: SequentialEvidenceDirection): string | undefined {
  const selected = steps
    .filter((step) => step.direction === directionValue)
    .sort((a, b) => Math.abs(b.logLikelihood) - Math.abs(a.logLikelihood))[0];
  return selected ? `${selected.label} (${selected.logLikelihood.toFixed(2)})` : undefined;
}

function direction(logLikelihood: number): SequentialEvidenceDirection {
  if (logLikelihood > 0.08) return "supports-execution";
  if (logLikelihood < -0.08) return "supports-rejection";
  return "neutral";
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function logit(value: number): number {
  return Math.log(value / (1 - value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function money(value: number): string {
  return `$${round(value).toFixed(2)}`;
}

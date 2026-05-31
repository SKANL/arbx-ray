import type { ConformalExecutionGuard } from "./conformal-execution-guard";
import type { LatencyAlphaRace } from "./latency-alpha-race";
import type { OpportunityHeatmap } from "./opportunity-heatmap";
import type { OpportunityDecision } from "./types";

export type OptimalStoppingPolicy = "execute-now" | "wait-short" | "wait-for-confirmation" | "cap-size" | "reject" | "wait-for-edge";

export type StoppingFrontierPoint = {
  horizonMs: number;
  survivalProbability: number;
  decayedEdgeUsd: number;
  optionValueUsd: number;
  volatilityCostUsd: number;
  conformalPenaltyUsd: number;
  expectedValueUsd: number;
};

export type OptimalStoppingFrontier = {
  generatedAt: number;
  frontier: StoppingFrontierPoint[];
  summary: {
    policy: OptimalStoppingPolicy;
    bestHorizonMs: number;
    immediateValueUsd: number;
    bestExpectedValueUsd: number;
    optionValueUsd: number;
    recommendedSizeBtc: number;
    stoppingScore: number;
  };
  equation: string;
  reasons: string[];
  sources: string[];
};

const horizonsMs = [0, 250, 1_000, 5_000, 15_000];

export function buildOptimalStoppingFrontier(input: {
  decision?: OpportunityDecision;
  latencyAlphaRace?: LatencyAlphaRace;
  conformalGuard?: ConformalExecutionGuard;
  opportunityHeatmap?: OpportunityHeatmap;
  realizedVolBpsPerSecond?: number;
  observedAt?: number;
}): OptimalStoppingFrontier {
  const generatedAt = input.observedAt ?? Date.now();
  const decision = input.decision;
  if (!decision || decision.status !== "accepted") {
    return {
      generatedAt,
      frontier: [],
      summary: {
        policy: "wait-for-edge",
        bestHorizonMs: 0,
        immediateValueUsd: 0,
        bestExpectedValueUsd: 0,
        optionValueUsd: 0,
        recommendedSizeBtc: 0,
        stoppingScore: 0,
      },
      equation: "EV(wait_t) = decayed_edge_t + option_value_t - volatility_cost_t - conformal_penalty_t",
      reasons: ["waiting for an accepted simulated route"],
      sources: [],
    };
  }

  const halfLifeMs = Math.max(80, input.latencyAlphaRace?.summary.edgeHalfLifeMs ?? 1_250);
  const realizedVolBpsPerSecond = Math.max(0, input.realizedVolBpsPerSecond ?? 4);
  const conformalPenaltyBase = Math.max(0, input.conformalGuard?.summary.quantileResidualUsd ?? 0);
  const notionalUsd = Math.max(decision.buyFill.notional, decision.sellFill.notional);
  const patternStrength = input.opportunityHeatmap?.summary.policy === "pattern-detected" ? input.opportunityHeatmap.summary.concentrationScore / 100 : 0;

  const frontier = horizonsMs.map((horizonMs) =>
    buildPoint({
      decision,
      horizonMs,
      halfLifeMs,
      notionalUsd,
      realizedVolBpsPerSecond,
      conformalPenaltyBase,
      patternStrength,
    }),
  );
  const ranked = [...frontier].sort((a, b) => b.expectedValueUsd - a.expectedValueUsd || a.horizonMs - b.horizonMs);
  const best = ranked[0] ?? frontier[0];
  const immediate = frontier[0] ?? best;
  const optionValueUsd = Math.max(0, (best?.expectedValueUsd ?? 0) - (immediate?.expectedValueUsd ?? 0));
  const recommendedSizeBtc =
    best && best.expectedValueUsd < 0 && decision.netProfitUsd > 0
      ? input.conformalGuard?.summary.recommendedSizeBtc || roundBtc(decision.tradeSizeBtc * 0.5)
      : decision.tradeSizeBtc;
  const policy = choosePolicy({ best, immediate, decision, optionValueUsd, recommendedSizeBtc });
  const stoppingScore = clampScore(
    45 +
      Math.max(-35, Math.min(35, (best?.expectedValueUsd ?? 0) * 1.4)) +
      ((best?.survivalProbability ?? 0) - 0.5) * 35 -
      (best?.horizonMs ?? 0) / 750,
  );

  return {
    generatedAt,
    frontier,
    summary: {
      policy,
      bestHorizonMs: best?.horizonMs ?? 0,
      immediateValueUsd: round(immediate?.expectedValueUsd ?? 0),
      bestExpectedValueUsd: round(best?.expectedValueUsd ?? 0),
      optionValueUsd: round(optionValueUsd),
      recommendedSizeBtc,
      stoppingScore,
    },
    equation:
      "EV(wait_t) = net_edge*exp(-t/half_life) + historical_pattern_option*sqrt(t) - notional*vol*sqrt(t) - conformal_q*sqrt(1+t/10s)",
    reasons: buildReasons(policy, best, immediate, halfLifeMs, patternStrength),
    sources: [
      ...(input.conformalGuard?.sources ?? []),
      "Optimal stopping frontier over live route, latency half-life, volatility, conformal residuals, and historical opportunity clustering",
    ],
  };
}

function buildPoint(input: {
  decision: OpportunityDecision;
  horizonMs: number;
  halfLifeMs: number;
  notionalUsd: number;
  realizedVolBpsPerSecond: number;
  conformalPenaltyBase: number;
  patternStrength: number;
}): StoppingFrontierPoint {
  const horizonSeconds = input.horizonMs / 1_000;
  const survivalProbability = Math.exp(-input.horizonMs / input.halfLifeMs);
  const decayedEdgeUsd = input.decision.netProfitUsd * survivalProbability;
  const optionValueUsd = input.horizonMs === 0 ? 0 : input.decision.netProfitUsd * input.patternStrength * 0.3 * Math.sqrt(Math.min(1, horizonSeconds));
  const volatilityCostUsd = input.notionalUsd * (input.realizedVolBpsPerSecond / 10_000) * Math.sqrt(Math.max(0, horizonSeconds));
  const conformalPenaltyUsd = input.conformalPenaltyBase * Math.sqrt(1 + horizonSeconds / 10);
  const expectedValueUsd = decayedEdgeUsd + optionValueUsd - volatilityCostUsd - conformalPenaltyUsd;
  return {
    horizonMs: input.horizonMs,
    survivalProbability: round(survivalProbability, 4),
    decayedEdgeUsd: round(decayedEdgeUsd),
    optionValueUsd: round(optionValueUsd),
    volatilityCostUsd: round(volatilityCostUsd),
    conformalPenaltyUsd: round(conformalPenaltyUsd),
    expectedValueUsd: round(expectedValueUsd),
  };
}

function choosePolicy(input: {
  best: StoppingFrontierPoint | undefined;
  immediate: StoppingFrontierPoint | undefined;
  decision: OpportunityDecision;
  optionValueUsd: number;
  recommendedSizeBtc: number;
}): OptimalStoppingPolicy {
  const best = input.best;
  if (!best) return "wait-for-edge";
  if (best.expectedValueUsd < 0 && input.decision.netProfitUsd > 0 && input.recommendedSizeBtc < input.decision.tradeSizeBtc) return "cap-size";
  if (best.expectedValueUsd < 0) return "reject";
  if (best.horizonMs === 0) return "execute-now";
  if (best.horizonMs <= 1_000 && input.optionValueUsd >= 0.5) return "wait-short";
  return "wait-for-confirmation";
}

function buildReasons(
  policy: OptimalStoppingPolicy,
  best: StoppingFrontierPoint | undefined,
  immediate: StoppingFrontierPoint | undefined,
  halfLifeMs: number,
  patternStrength: number,
): string[] {
  if (!best || !immediate) return ["waiting for an accepted simulated route"];
  return [
    policy === "execute-now" ? "immediate crossing maximizes expected value" : `best horizon ${best.horizonMs}ms beats immediate crossing`,
    `edge half-life ${Math.round(halfLifeMs)}ms`,
    patternStrength > 0.5 ? "historical opportunity clustering adds wait option value" : "historical clustering is weak or unavailable",
    best.expectedValueUsd < 0 ? "cap or reject because all timing choices are fragile" : `best EV ${money(best.expectedValueUsd)}`,
  ];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function roundBtc(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function money(value: number): string {
  return `$${round(value).toFixed(2)}`;
}

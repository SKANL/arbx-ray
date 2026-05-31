import type { HistoricalReplay } from "./historical";
import type { LiquidityRadar } from "./liquidity-radar";
import type { EngineThroughputLab } from "./performance-lab";
import type { StressResult } from "./stress";
import type { FeedHealth, OpportunityDecision } from "./types";

export type EdgeConvictionFactor = {
  id: string;
  label: string;
  weight: number;
  evidence: string;
};

export type EdgeConviction = {
  posteriorProbability: number;
  confidenceInterval: {
    low: number;
    high: number;
  };
  evidenceScore: number;
  recommendation: "simulate-execute" | "cap-size" | "reject" | "wait-for-evidence";
  factors: EdgeConvictionFactor[];
  explanation: string;
};

export function buildEdgeConviction(input: {
  decision?: OpportunityDecision;
  stressResults: StressResult[];
  historicalReplay?: HistoricalReplay;
  liquidityRadar?: LiquidityRadar;
  throughput?: EngineThroughputLab;
  health: FeedHealth[];
}): EdgeConviction {
  const factors: EdgeConvictionFactor[] = [];
  const decision = input.decision;

  if (!decision) {
    factors.push({
      id: "decision-state",
      label: "No active decision",
      weight: -1.2,
      evidence: "Wait for a live or replay route before estimating conviction.",
    });
  } else if (decision.status === "accepted") {
    const netBps = netEdgeBps(decision);
    factors.push({
      id: "decision-state",
      label: "Execution policy accepted",
      weight: 0.95 + clamp(netBps / 20, -0.25, 0.65),
      evidence: `Net edge ${netBps.toFixed(2)} bps after fees, rebalance, latency, and depth.`,
    });
    factors.push({
      id: "pnl-probability",
      label: "Positive P&L probability",
      weight: probabilityToLogitWeight(decision.risk.positivePnlProbability, 0.62),
      evidence: `Model P(win) ${(decision.risk.positivePnlProbability * 100).toFixed(1)}%.`,
    });
  } else {
    factors.push({
      id: "decision-state",
      label: "Execution policy rejected",
      weight: -2.2,
      evidence: decision.rejectionReasons.join("; ") || "Current route failed policy.",
    });
  }

  const stressSurvival = ratio(input.stressResults.filter((result) => result.survives).length, input.stressResults.length);
  factors.push({
    id: "stress-survival",
    label: "Stress survival",
    weight: input.stressResults.length > 0 ? (stressSurvival - 0.5) * 1.5 : -0.25,
    evidence:
      input.stressResults.length > 0
        ? `${Math.round(stressSurvival * 100)}% of stress scenarios survive.`
        : "No stress evidence yet.",
  });

  const statArb = input.historicalReplay?.statArb;
  if (statArb) {
    const regimeWeight =
      statArb.regime === "mean-reverting"
        ? 0.45
        : statArb.regime === "breakout-risk"
          ? -0.55
          : -0.2;
    const zWeight = Math.abs(statArb.latestZScore) >= 1 ? 0.2 : -0.05;
    factors.push({
      id: "historical-regime",
      label: "Historical stat-arb regime",
      weight: regimeWeight + zWeight + clamp((statArb.returnCorrelation - 0.75) * 0.7, -0.2, 0.25),
      evidence: `${statArb.regime}; corr ${statArb.returnCorrelation.toFixed(2)}, z ${statArb.latestZScore.toFixed(2)}.`,
    });
  } else {
    factors.push({
      id: "historical-regime",
      label: "Historical stat-arb regime",
      weight: -0.15,
      evidence: "Historical replay not loaded.",
    });
  }

  const liquidity = input.liquidityRadar?.summary;
  if (liquidity) {
    const executableRatio = ratio(liquidity.executableRoutes, liquidity.routeCount);
    factors.push({
      id: "external-liquidity",
      label: "External liquidity confirmation",
      weight: (executableRatio - 0.2) * 0.9 + (liquidity.bestNetProfitUsd > 0 ? 0.25 : -0.12),
      evidence: `${liquidity.executableRoutes}/${liquidity.routeCount} REST routes executable; best net ${liquidity.bestNetProfitUsd.toFixed(2)} USD.`,
    });
  } else {
    factors.push({
      id: "external-liquidity",
      label: "External liquidity confirmation",
      weight: -0.15,
      evidence: "Global Liquidity Radar not loaded.",
    });
  }

  const liveHealth = ratio(input.health.filter((feed) => feed.status === "live").length, input.health.length);
  factors.push({
    id: "feed-health",
    label: "Feed health",
    weight: input.health.length > 0 ? (liveHealth - 0.5) * 0.8 : -0.2,
    evidence:
      input.health.length > 0
        ? `${Math.round(liveHealth * 100)}% selected feeds are live.`
        : "No feed health evidence yet.",
  });

  if (input.throughput) {
    factors.push({
      id: "throughput-sla",
      label: "Throughput SLA",
      weight:
        input.throughput.sla.status === "pass"
          ? 0.35
          : input.throughput.sla.status === "watch"
            ? 0.05
            : -0.45,
      evidence: `${input.throughput.sla.status}; p95 uses ${input.throughput.sla.utilizationPct.toFixed(1)}% of latency budget.`,
    });
  }

  const logit = -0.35 + factors.reduce((sum, factor) => sum + factor.weight, 0);
  const posteriorProbability = sigmoid(logit);
  const positiveSignals = factors.filter((factor) => factor.weight > 0.15).length;
  const negativeSignals = factors.filter((factor) => factor.weight < 0).length;
  const evidenceScore = clamp(35 + positiveSignals * 12 - negativeSignals * 7 + (decision ? 14 : 0), 0, 100);
  const intervalWidth = clamp(0.28 - evidenceScore / 600, 0.08, 0.28);
  const recommendation = recommend(posteriorProbability, evidenceScore, decision);

  return {
    posteriorProbability,
    confidenceInterval: {
      low: clamp(posteriorProbability - intervalWidth, 0.001, 0.999),
      high: clamp(posteriorProbability + intervalWidth, 0.001, 0.999),
    },
    evidenceScore,
    recommendation,
    factors,
    explanation: `posterior = sigmoid(prior + ${factors.length} evidence weights) = ${(posteriorProbability * 100).toFixed(1)}%`,
  };
}

function recommend(
  posterior: number,
  evidenceScore: number,
  decision?: OpportunityDecision,
): EdgeConviction["recommendation"] {
  if (!decision) return "wait-for-evidence";
  if (decision.status === "rejected" || posterior < 0.5) return "reject";
  if (posterior >= 0.72 && evidenceScore >= 65) return "simulate-execute";
  return "cap-size";
}

function netEdgeBps(decision: OpportunityDecision): number {
  const notional = Math.max(decision.buyFill.notional, decision.sellFill.notional);
  return notional > 0 ? (decision.netProfitUsd / notional) * 10_000 : 0;
}

function probabilityToLogitWeight(probability: number, neutral: number): number {
  return clamp(logit(clamp(probability, 0.001, 0.999)) - logit(neutral), -0.9, 0.9);
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
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

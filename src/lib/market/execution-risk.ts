import type { OpportunityDecision } from "./types";

export type LatencyRiskPoint = {
  latencyMs: number;
  expectedPnlUsd: number;
  p05PnlUsd: number;
  p50PnlUsd: number;
  p95PnlUsd: number;
  positiveProbability: number;
};

export type LatencyRiskCone = {
  points: LatencyRiskPoint[];
  valueAtRisk95Usd: number;
  expectedShortfall95Usd: number;
  breakEvenLatencyMs?: number;
};

export type MonteCarloBin = {
  fromUsd: number;
  toUsd: number;
  count: number;
};

export type MonteCarloExecution = {
  trials: number;
  horizonMs: number;
  meanPnlUsd: number;
  medianPnlUsd: number;
  p05PnlUsd: number;
  p95PnlUsd: number;
  valueAtRisk95Usd: number;
  expectedShortfall95Usd: number;
  lossProbability: number;
  histogram: MonteCarloBin[];
};

export type KellySizing = {
  notionalUsd: number;
  meanReturnBps: number;
  varianceReturn: number;
  fullKellyFraction: number;
  fractionalKelly: number;
  cappedFraction: number;
  recommendedNotionalUsd: number;
  recommendedBtc: number;
  maxLossAtVarUsd: number;
  decision: "increase" | "cap" | "skip";
  reason: string;
};

const latenciesMs = [50, 100, 250, 500, 1_000, 2_000];
const z95 = 1.6448536269514722;

export function buildLatencyRiskCone(
  decision: OpportunityDecision,
  realizedVolBpsPerSecond: number,
): LatencyRiskCone {
  const notionalUsd = Math.max(decision.buyFill.notional, decision.sellFill.notional);
  const preLatencyNetUsd = decision.netProfitUsd + decision.risk.latencyPenaltyUsd;
  const points = latenciesMs.map((latencyMs) => {
    const sigmaUsd = latencySigmaUsd(notionalUsd, realizedVolBpsPerSecond, latencyMs);
    const expectedPnlUsd =
      preLatencyNetUsd -
      notionalUsd *
        (Math.max(0, realizedVolBpsPerSecond) / 10_000) *
        (latencyMs / 1_000);
    return {
      latencyMs,
      expectedPnlUsd,
      p05PnlUsd: expectedPnlUsd - z95 * sigmaUsd,
      p50PnlUsd: expectedPnlUsd,
      p95PnlUsd: expectedPnlUsd + z95 * sigmaUsd,
      positiveProbability: sigmaUsd <= 1e-9 ? (expectedPnlUsd > 0 ? 1 : 0) : clamp(normalCdf(expectedPnlUsd / sigmaUsd), 0.001, 0.999),
    };
  });

  const oneSecondPoint = points.find((point) => point.latencyMs === 1_000) ?? points[points.length - 1];
  const oneSecondSigmaUsd = latencySigmaUsd(notionalUsd, realizedVolBpsPerSecond, 1_000);
  const valueAtRisk95Usd = Math.max(0, -((oneSecondPoint?.expectedPnlUsd ?? 0) - z95 * oneSecondSigmaUsd));
  const expectedShortfall95Usd = Math.max(0, -((oneSecondPoint?.expectedPnlUsd ?? 0) - 2.0627 * oneSecondSigmaUsd));
  const breakEven = points.find((point) => point.expectedPnlUsd <= 0)?.latencyMs;

  return {
    points,
    valueAtRisk95Usd,
    expectedShortfall95Usd,
    breakEvenLatencyMs: breakEven,
  };
}

export function runMonteCarloExecution(input: {
  decision: OpportunityDecision;
  realizedVolBpsPerSecond: number;
  trials?: number;
  horizonMs?: number;
  seed?: number;
  bins?: number;
}): MonteCarloExecution {
  const trials = Math.max(50, Math.floor(input.trials ?? 2_000));
  const horizonMs = Math.max(1, input.horizonMs ?? 1_000);
  const bins = Math.max(5, Math.floor(input.bins ?? 18));
  const notionalUsd = Math.max(input.decision.buyFill.notional, input.decision.sellFill.notional);
  const sigmaUsd = latencySigmaUsd(notionalUsd, input.realizedVolBpsPerSecond, horizonMs);
  const driftCostUsd =
    notionalUsd *
    (Math.max(0, input.realizedVolBpsPerSecond) / 10_000) *
    (horizonMs / 1_000);
  const expectedPnlUsd = input.decision.netProfitUsd + input.decision.risk.latencyPenaltyUsd - driftCostUsd;
  const random = mulberry32(input.seed ?? hashString(input.decision.id));
  const outcomes: number[] = [];

  for (let index = 0; index < trials; index += 1) {
    const shock = randomNormal(random) * sigmaUsd;
    outcomes.push(expectedPnlUsd + shock);
  }

  outcomes.sort((a, b) => a - b);
  const p05PnlUsd = percentile(outcomes, 0.05);
  const medianPnlUsd = percentile(outcomes, 0.5);
  const p95PnlUsd = percentile(outcomes, 0.95);
  const losses = outcomes.filter((value) => value < 0);
  return {
    trials,
    horizonMs,
    meanPnlUsd: outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length,
    medianPnlUsd,
    p05PnlUsd,
    p95PnlUsd,
    valueAtRisk95Usd: Math.max(0, -p05PnlUsd),
    expectedShortfall95Usd:
      losses.length > 0
        ? Math.max(0, -losses.slice(0, Math.max(1, Math.floor(outcomes.length * 0.05))).reduce((sum, value) => sum + value, 0) / Math.max(1, Math.floor(outcomes.length * 0.05)))
        : 0,
    lossProbability: losses.length / outcomes.length,
    histogram: buildHistogram(outcomes, bins),
  };
}

export function deriveKellySizing(input: {
  decision: OpportunityDecision;
  simulation: MonteCarloExecution;
  bankrollUsd?: number;
  fraction?: number;
  maxFraction?: number;
}): KellySizing {
  const bankrollUsd = Math.max(0, input.bankrollUsd ?? 100_000);
  const fraction = Math.max(0, input.fraction ?? 0.25);
  const maxFraction = Math.max(0, input.maxFraction ?? 0.08);
  const notionalUsd = Math.max(input.decision.buyFill.notional, input.decision.sellFill.notional);
  const meanReturn = notionalUsd > 0 ? input.simulation.meanPnlUsd / notionalUsd : 0;
  const p05Return = notionalUsd > 0 ? input.simulation.p05PnlUsd / notionalUsd : 0;
  const p95Return = notionalUsd > 0 ? input.simulation.p95PnlUsd / notionalUsd : 0;
  const sigmaApprox = (p95Return - p05Return) / (2 * z95);
  const varianceReturn = sigmaApprox ** 2;
  const rawKellyFraction = varianceReturn > 1e-12 ? meanReturn / varianceReturn : meanReturn > 0 ? 1 : 0;
  const fullKellyFraction = clamp(rawKellyFraction, 0, 1);
  const fractionalKelly = Math.max(0, fullKellyFraction * fraction);
  const cappedFraction = Math.min(maxFraction, fractionalKelly);
  const recommendedNotionalUsd = bankrollUsd * cappedFraction;
  const recommendedBtc = input.decision.buyFill.vwap > 0 ? recommendedNotionalUsd / input.decision.buyFill.vwap : 0;
  const skip =
    input.decision.status !== "accepted" ||
    input.simulation.meanPnlUsd <= 0 ||
    input.simulation.lossProbability >= 0.35 ||
    cappedFraction <= 0;
  const capped = !skip && fractionalKelly > maxFraction;
  return {
    notionalUsd,
    meanReturnBps: meanReturn * 10_000,
    varianceReturn,
    fullKellyFraction,
    fractionalKelly,
    cappedFraction: skip ? 0 : cappedFraction,
    recommendedNotionalUsd: skip ? 0 : recommendedNotionalUsd,
    recommendedBtc: skip ? 0 : recommendedBtc,
    maxLossAtVarUsd: input.simulation.valueAtRisk95Usd,
    decision: skip ? "skip" : capped ? "cap" : "increase",
    reason: skip
      ? "Do not allocate: expected edge, acceptance, or loss probability fails the sizing policy."
      : capped
        ? "Allocate at the risk cap: fractional Kelly exceeds the maximum bankroll fraction."
        : "Allocate below cap: fractional Kelly supports the simulated trade size.",
  };
}


function latencySigmaUsd(
  notionalUsd: number,
  realizedVolBpsPerSecond: number,
  latencyMs: number,
): number {
  return (
    notionalUsd *
    (Math.max(0, realizedVolBpsPerSecond) / 10_000) *
    Math.sqrt(Math.max(0.001, latencyMs / 1_000))
  );
}

function normalCdf(value: number): number {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function randomNormal(random: () => number): number {
  const u1 = Math.max(Number.EPSILON, random());
  const u2 = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function percentile(sortedValues: number[], probability: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor(probability * (sortedValues.length - 1))));
  return sortedValues[index] ?? 0;
}

function buildHistogram(sortedValues: number[], bins: number): MonteCarloBin[] {
  if (sortedValues.length === 0) return [];
  const min = sortedValues[0] ?? 0;
  const max = sortedValues[sortedValues.length - 1] ?? min;
  const width = Math.max(1e-9, (max - min) / bins);
  const histogram = Array.from({ length: bins }, (_, index) => ({
    fromUsd: min + index * width,
    toUsd: min + (index + 1) * width,
    count: 0,
  }));
  for (const value of sortedValues) {
    const index = Math.min(bins - 1, Math.max(0, Math.floor((value - min) / width)));
    const bin = histogram[index];
    if (bin) bin.count += 1;
  }
  return histogram;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function erf(value: number): number {
  const sign = value >= 0 ? 1 : -1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return sign * y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

import type { HistoricalReplay, HistoricalTrade } from "./historical";

export type RegimeBreakPolicy = "trust-history" | "cap-size" | "retrain" | "insufficient-history";

export type RegimeBreakObservation = {
  index: number;
  timestamp: number;
  spreadBps: number;
  netProfitUsd: number;
  runLength: number;
  breakProbability: number;
  predictiveMeanBps: number;
  predictiveSigmaBps: number;
};

export type RegimeBreakPoint = {
  index: number;
  timestamp: number;
  probability: number;
  beforeMeanBps: number;
  afterMeanBps: number;
  shiftBps: number;
};

export type BayesianRegimeBreakLab = {
  generatedAt: number;
  observations: RegimeBreakObservation[];
  changepoints: RegimeBreakPoint[];
  summary: {
    policy: RegimeBreakPolicy;
    sampleCount: number;
    hazardRate: number;
    latestBreakProbability: number;
    latestRunLength: number;
    regimeShiftBps: number;
    expectedEdgeDecayBps: number;
    posteriorTrustScore: number;
  };
  reasons: string[];
  equation: string;
  sources: string[];
};

export function buildBayesianRegimeBreakLab(input: {
  replay?: HistoricalReplay;
  hazardRate?: number;
  minSamples?: number;
  generatedAt?: number;
}): BayesianRegimeBreakLab {
  const minSamples = input.minSamples ?? 8;
  const hazardRate = clampProbability(input.hazardRate ?? 0.06);
  const trades = [...(input.replay?.trades ?? [])].sort((a, b) => a.timestamp - b.timestamp);
  if (trades.length < minSamples) {
    return {
      generatedAt: input.generatedAt ?? Date.now(),
      observations: [],
      changepoints: [],
      summary: {
        policy: "insufficient-history",
        sampleCount: trades.length,
        hazardRate,
        latestBreakProbability: 0,
        latestRunLength: 0,
        regimeShiftBps: 0,
        expectedEdgeDecayBps: 0,
        posteriorTrustScore: 0,
      },
      reasons: ["Need at least 8 historical simulated trades for Bayesian change-point evidence."],
      equation,
      sources: input.replay?.sources ?? [],
    };
  }

  const observations: RegimeBreakObservation[] = [];
  const changepoints: RegimeBreakPoint[] = [];
  let runStart = 0;
  let lastBreakIndex = -Infinity;

  for (let index = 0; index < trades.length; index += 1) {
    const trade = trades[index];
    if (!trade) continue;
    const run = trades.slice(runStart, index);
    const runStats = stats(run.map((item) => item.spreadBps));
    const broadStats = stats(trades.slice(0, index + 1).map((item) => item.spreadBps));
    const predictiveMeanBps = run.length >= 3 ? runStats.mean : broadStats.mean;
    const predictiveSigmaBps = Math.max(1.5, runStats.sigma, broadStats.sigma * 0.35);
    const continuationLikelihood = gaussianPdf(trade.spreadBps, predictiveMeanBps, predictiveSigmaBps);
    const changeLikelihood = gaussianPdf(trade.spreadBps, broadStats.mean, Math.max(8, broadStats.sigma * 2.5));
    const breakProbability =
      run.length >= 4
        ? (hazardRate * changeLikelihood) /
          Math.max(1e-12, hazardRate * changeLikelihood + (1 - hazardRate) * continuationLikelihood)
        : hazardRate;
    const normalizedBreakProbability = clampProbability(breakProbability);
    const observation: RegimeBreakObservation = {
      index,
      timestamp: trade.timestamp,
      spreadBps: trade.spreadBps,
      netProfitUsd: trade.netProfitUsd,
      runLength: index - runStart,
      breakProbability: normalizedBreakProbability,
      predictiveMeanBps,
      predictiveSigmaBps,
    };
    observations.push(observation);

    if (normalizedBreakProbability >= 0.55 && index - lastBreakIndex >= 4) {
      const before = trades.slice(Math.max(0, runStart), index).map((item) => item.spreadBps);
      const after = trades.slice(index, Math.min(trades.length, index + Math.max(4, Math.min(8, trades.length - index)))).map((item) => item.spreadBps);
      const beforeMeanBps = stats(before).mean;
      const afterMeanBps = stats(after).mean;
      changepoints.push({
        index,
        timestamp: trade.timestamp,
        probability: normalizedBreakProbability,
        beforeMeanBps,
        afterMeanBps,
        shiftBps: afterMeanBps - beforeMeanBps,
      });
      runStart = index;
      lastBreakIndex = index;
    }
  }

  const latestWindow = observations.slice(-8);
  const latestBreakProbability = Math.max(0, ...latestWindow.map((item) => item.breakProbability));
  const strongest = [...changepoints].sort((a, b) => Math.abs(b.shiftBps) - Math.abs(a.shiftBps))[0];
  const latestRunLength = observations[observations.length - 1]?.runLength ?? 0;
  const regimeShiftBps = strongest?.shiftBps ?? 0;
  const expectedEdgeDecayBps = Math.max(0, -(strongest?.shiftBps ?? 0));
  const posteriorTrustScore = clampScore(
    100 - latestBreakProbability * 70 - Math.min(25, expectedEdgeDecayBps * 1.3) + Math.min(8, latestRunLength / 3),
  );
  const policy: RegimeBreakPolicy =
    latestBreakProbability >= 0.55 || expectedEdgeDecayBps >= 15
      ? "retrain"
      : latestBreakProbability >= 0.32 || expectedEdgeDecayBps >= 8
        ? "cap-size"
        : "trust-history";

  return {
    generatedAt: input.generatedAt ?? Date.now(),
    observations,
    changepoints,
    summary: {
      policy,
      sampleCount: trades.length,
      hazardRate,
      latestBreakProbability: round(latestBreakProbability, 4),
      latestRunLength,
      regimeShiftBps: round(regimeShiftBps, 2),
      expectedEdgeDecayBps: round(expectedEdgeDecayBps, 2),
      posteriorTrustScore,
    },
    reasons: buildReasons(policy, changepoints, expectedEdgeDecayBps, latestBreakProbability),
    equation,
    sources: input.replay?.sources ?? [],
  };
}

const equation =
  "P(change_t | x_1:t) = h * p(x_t | new_regime) / [h * p(x_t | new_regime) + (1-h) * p(x_t | current_run)]; current_run uses the live posterior run length.";

function buildReasons(
  policy: RegimeBreakPolicy,
  changepoints: RegimeBreakPoint[],
  expectedEdgeDecayBps: number,
  latestBreakProbability: number,
): string[] {
  if (policy === "trust-history") {
    return ["Historical spread distribution is stable enough for walk-forward evidence to remain usable."];
  }
  const strongest = changepoints[0];
  return [
    strongest
      ? `Change point at ${new Date(strongest.timestamp).toISOString()} shifted spread by ${round(strongest.shiftBps)} bps.`
      : "Recent observations carry elevated change-point probability.",
    `Expected historical edge decay is ${round(expectedEdgeDecayBps)} bps; latest posterior break probability ${(latestBreakProbability * 100).toFixed(1)}%.`,
  ];
}

function stats(values: number[]): { mean: number; sigma: number } {
  if (values.length === 0) return { mean: 0, sigma: 1 };
  const mean = values.reduce((sum, item) => sum + item, 0) / values.length;
  const variance =
    values.length > 1
      ? values.reduce((sum, item) => sum + (item - mean) ** 2, 0) / (values.length - 1)
      : 1;
  return { mean, sigma: Math.sqrt(Math.max(1e-6, variance)) };
}

function gaussianPdf(value: number, mean: number, sigma: number): number {
  const safeSigma = Math.max(1e-6, sigma);
  const z = (value - mean) / safeSigma;
  return Math.exp(-0.5 * z * z) / (safeSigma * Math.sqrt(2 * Math.PI));
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0.001, Math.min(0.999, value));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

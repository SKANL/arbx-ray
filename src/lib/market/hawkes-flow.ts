import type { TradeTapeToxicity, TradeTapeVenueSummary } from "./trade-tape";

export type HawkesFlowPolicy = "allow" | "cap-size" | "wait-for-calm" | "halt-shock";
export type HawkesVenueState = "benign" | "active" | "critical";

export type HawkesVenueShock = {
  exchangeId: string;
  state: HawkesVenueState;
  branchingRatio: number;
  baselineIntensityPerSecond: number;
  excitedIntensityPerSecond: number;
  aftershockProbability: number;
  expectedShockBtc: number;
  signedPressure: "buy" | "sell" | "balanced";
  evidence: string;
};

export type HawkesFlowShockOracle = {
  generatedAt: number;
  venues: HawkesVenueShock[];
  reasons: string[];
  summary: {
    policy: HawkesFlowPolicy;
    branchingRatio: number;
    aftershockProbability: number;
    expectedShockBtc: number;
    shockHalfLifeSeconds: number;
    topDepthCoveragePct: number;
    sourceCount: number;
  };
  equation: string;
};

export function buildHawkesFlowShockOracle(input: {
  tradeTape?: TradeTapeToxicity;
  topDepthBtc?: number;
  observedAt?: number;
}): HawkesFlowShockOracle {
  const generatedAt = input.observedAt ?? Date.now();
  const tape = input.tradeTape;
  if (!tape || tape.venues.length === 0) {
    return emptyOracle(generatedAt);
  }

  const topDepthBtc = Math.max(0.001, input.topDepthBtc ?? 0.5);
  const windowSeconds = Math.max(15, tape.windowMs / 1_000);
  const venues = tape.venues.map((venue) => venueShock(venue, windowSeconds, topDepthBtc));
  const totalTrades = Math.max(1, tape.summary.tradeCount);
  const branchingRatio = weightedAverage(venues, tape.venues.map((venue) => venue.tradeCount), "branchingRatio");
  const aftershockProbability = weightedAverage(venues, tape.venues.map((venue) => venue.tradeCount), "aftershockProbability");
  const expectedShockBtc = round(venues.reduce((sum, venue) => sum + venue.expectedShockBtc, 0));
  const shockHalfLifeSeconds = round(halfLifeSeconds(branchingRatio, tape.summary.combinedScore));
  const topDepthCoveragePct = round((expectedShockBtc / topDepthBtc) * 100);
  const policy = choosePolicy({ branchingRatio, aftershockProbability, expectedShockBtc, topDepthBtc, toxicVenues: tape.summary.toxicVenues });

  return {
    generatedAt,
    venues,
    reasons: reasons({ policy, branchingRatio, aftershockProbability, expectedShockBtc, topDepthBtc, topDepthCoveragePct }),
    summary: {
      policy,
      branchingRatio: round(branchingRatio, 4),
      aftershockProbability: round(aftershockProbability, 4),
      expectedShockBtc,
      shockHalfLifeSeconds,
      topDepthCoveragePct,
      sourceCount: tape.sources.length,
    },
    equation:
      "branching_ratio = clamp(flow_clustering * toxicity * aligned_drift, 0, 0.98); aftershock_probability = 1 - exp(-excited_intensity * shock_horizon_sec); expected_shock_btc = dominant_flow_btc * branching_ratio / (1 - branching_ratio)",
  };
}

function venueShock(venue: TradeTapeVenueSummary, windowSeconds: number, topDepthBtc: number): HawkesVenueShock {
  const tradeIntensity = venue.tradeCount / windowSeconds;
  const baselineIntensityPerSecond = Math.max(0, tradeIntensity * (1 - Math.min(0.8, venue.toxicityScore / 130)));
  const flowClustering = clamp(venue.tradesPerMinute / 160, 0, 1.15);
  const toxicity = clamp(venue.toxicityScore / 100, 0, 1);
  const alignedDrift =
    Math.sign(venue.imbalance) !== 0 &&
    Math.sign(venue.priceDriftBps) !== 0 &&
    Math.sign(venue.imbalance) === Math.sign(venue.priceDriftBps)
      ? 1.16
      : 0.72;
  const sizePressure = clamp((Math.abs(venue.signedVolumeBtc) + venue.averageTradeBtc * venue.tradeCount * 0.25) / Math.max(0.001, topDepthBtc), 0, 4);
  const branchingRatio = clamp(flowClustering * toxicity * alignedDrift + Math.min(0.22, sizePressure * 0.05), 0, 0.98);
  const excitedIntensityPerSecond = tradeIntensity * (1 + branchingRatio / Math.max(0.05, 1 - branchingRatio));
  const horizonSeconds = 12;
  const aftershockProbability = clamp(1 - Math.exp(-excitedIntensityPerSecond * branchingRatio * horizonSeconds), 0, 0.999);
  const dominantFlowBtc = Math.max(venue.buyAggressorBtc, venue.sellAggressorBtc);
  const expectedShockBtc = dominantFlowBtc * branchingRatio / Math.max(0.08, 1 - branchingRatio);
  const state: HawkesVenueState =
    branchingRatio >= 0.78 || aftershockProbability >= 0.75 || expectedShockBtc > topDepthBtc
      ? "critical"
      : branchingRatio >= 0.45 || aftershockProbability >= 0.5
        ? "active"
        : "benign";

  return {
    exchangeId: venue.exchangeId,
    state,
    branchingRatio: round(branchingRatio, 4),
    baselineIntensityPerSecond: round(baselineIntensityPerSecond, 4),
    excitedIntensityPerSecond: round(excitedIntensityPerSecond, 4),
    aftershockProbability: round(aftershockProbability, 4),
    expectedShockBtc: round(expectedShockBtc, 4),
    signedPressure: venue.signedVolumeBtc > 0 ? "buy" : venue.signedVolumeBtc < 0 ? "sell" : "balanced",
    evidence: `${venue.exchangeId} ${venue.state}; ${venue.tradesPerMinute.toFixed(1)} trades/min, drift ${venue.priceDriftBps.toFixed(2)} bps, imbalance ${(venue.imbalance * 100).toFixed(1)}%`,
  };
}

function choosePolicy(input: {
  branchingRatio: number;
  aftershockProbability: number;
  expectedShockBtc: number;
  topDepthBtc: number;
  toxicVenues: number;
}): HawkesFlowPolicy {
  if (input.branchingRatio >= 0.78 || input.aftershockProbability >= 0.72 || input.expectedShockBtc >= input.topDepthBtc || input.toxicVenues >= 2) {
    return "halt-shock";
  }
  if (input.branchingRatio >= 0.55 || input.aftershockProbability >= 0.55 || input.expectedShockBtc >= input.topDepthBtc * 0.45) {
    return "cap-size";
  }
  if (input.branchingRatio >= 0.35 || input.aftershockProbability >= 0.35) return "wait-for-calm";
  return "allow";
}

function reasons(input: {
  policy: HawkesFlowPolicy;
  branchingRatio: number;
  aftershockProbability: number;
  expectedShockBtc: number;
  topDepthBtc: number;
  topDepthCoveragePct: number;
}): string[] {
  return [
    input.policy === "halt-shock"
      ? "self-exciting flow shock can consume visible liquidity before execution"
      : input.policy === "allow"
        ? "recent aggressor flow is not self-exciting"
        : "flow excitation requires smaller simulated sizing or waiting",
    `branching ratio ${(input.branchingRatio * 100).toFixed(1)}%`,
    `aftershock probability ${(input.aftershockProbability * 100).toFixed(1)}%`,
    `expected shock ${round(input.expectedShockBtc, 4)} BTC vs top depth ${round(input.topDepthBtc, 4)} BTC`,
    `top-depth coverage ${input.topDepthCoveragePct.toFixed(1)}%`,
  ];
}

function halfLifeSeconds(branchingRatio: number, toxicityScore: number): number {
  const decay = 0.08 + (1 - clamp(branchingRatio, 0, 0.98)) * 0.55 + Math.max(0, 60 - toxicityScore) / 180;
  return Math.log(2) / Math.max(0.04, decay);
}

function weightedAverage<T extends keyof HawkesVenueShock>(
  venues: HawkesVenueShock[],
  weights: number[],
  key: T,
): number {
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) return 0;
  return venues.reduce((sum, venue, index) => sum + Number(venue[key]) * (weights[index] ?? 0), 0) / totalWeight;
}

function emptyOracle(generatedAt: number): HawkesFlowShockOracle {
  return {
    generatedAt,
    venues: [],
    reasons: ["waiting for public trade tape"],
    summary: {
      policy: "wait-for-calm",
      branchingRatio: 0,
      aftershockProbability: 0,
      expectedShockBtc: 0,
      shockHalfLifeSeconds: 0,
      topDepthCoveragePct: 0,
      sourceCount: 0,
    },
    equation:
      "branching_ratio = clamp(flow_clustering * toxicity * aligned_drift, 0, 0.98); aftershock_probability = 1 - exp(-excited_intensity * shock_horizon_sec); expected_shock_btc = dominant_flow_btc * branching_ratio / (1 - branching_ratio)",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

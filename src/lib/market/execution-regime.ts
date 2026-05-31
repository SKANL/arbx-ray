type SourceCarrier = { sources?: string[] };

export type ExecutionRegimeFactor = {
  id: string;
  label: string;
  score: number;
  haircutBps: number;
  state: "positive" | "neutral" | "warning" | "critical" | "missing";
  evidence: string;
  hardStopLabel?: string;
};

export type ExecutionRegimeFusion = {
  score: number;
  action: "simulate-execute" | "cap-size" | "wait-for-evidence" | "halt";
  confidence: "high" | "medium" | "low";
  combinedHaircutBps: number;
  hardStops: string[];
  factors: ExecutionRegimeFactor[];
  formula: string;
  sources: string[];
};

export function buildExecutionRegimeFusion(input: {
  marketContext?: SourceCarrier & {
    volatility?: { realizedVolBpsPerSecond?: number };
    sentiment?: { value?: number };
  };
  tradeTape?: SourceCarrier & {
    summary?: { combinedScore?: number; recommendation?: string };
  };
  derivativesPressure?: SourceCarrier & {
    summary?: { riskState?: string; spotExecutionHaircutBps?: number; direction?: string };
  };
  optionsIv?: SourceCarrier & {
    summary?: { regime?: string; executionHaircutBps?: number; expectedMove1hBps?: number; atmIvPct?: number };
  };
  usdtBasis?: SourceCarrier & {
    summary?: { policy?: string; dynamicHaircutBps?: number };
  };
  priceConsensus?: SourceCarrier & {
    summary?: { confidence?: string; outlierCount?: number; staleCount?: number; maxPremiumBps?: number };
  };
  liquidityRadar?: SourceCarrier & {
    summary?: { executableRoutes?: number; routeCount?: number; bestNetProfitUsd?: number; sourceCount?: number };
  };
  venueLatency?: SourceCarrier & {
    summary?: { medianP95Ms?: number };
  };
  venueReliability?: SourceCarrier & {
    summary?: {
      policy?: string;
      averageScore?: number;
      haltedVenues?: number;
      cappedVenues?: number;
      totalHaircutBps?: number;
      worstVenue?: string;
    };
  };
  leadLag?: SourceCarrier & {
    summary?: {
      policy?: string;
      confidence?: string;
      executionHaircutBps?: number;
      leaderVenue?: string;
      predictedDriftBps?: number;
      divergenceBps?: number;
    };
  };
}): ExecutionRegimeFusion {
  const factors: ExecutionRegimeFactor[] = [
    marketContextFactor(input.marketContext),
    tradeTapeFactor(input.tradeTape),
    leadLagFactor(input.leadLag),
    derivativesFactor(input.derivativesPressure),
    optionsIvFactor(input.optionsIv),
    usdtBasisFactor(input.usdtBasis),
    priceConsensusFactor(input.priceConsensus),
    liquidityFactor(input.liquidityRadar),
    latencyFactor(input.venueLatency),
    reliabilityFactor(input.venueReliability),
  ];
  const hardStops = factors
    .filter((factor) => factor.state === "critical")
    .map((factor) => factor.hardStopLabel ?? factor.label);
  const available = factors.filter((factor) => factor.state !== "missing");
  const missing = factors.length - available.length;
  const averageScore =
    available.length > 0 ? available.reduce((sum, factor) => sum + factor.score, 0) / available.length : 0;
  const missingPenalty = missing * 4;
  const criticalPenalty = hardStops.length * 8;
  const score = clampScore(averageScore - missingPenalty - criticalPenalty);
  const combinedHaircutBps = round(
    factors.reduce((sum, factor) => sum + factor.haircutBps, 0),
    2,
  );
  const action =
    hardStops.length > 0 || score < 35
      ? "halt"
      : available.length < 5
        ? "wait-for-evidence"
        : score >= 80
          ? "simulate-execute"
          : score >= 55
            ? "cap-size"
            : "wait-for-evidence";
  const confidence = available.length >= 7 && missing === 0 ? "high" : available.length >= 5 ? "medium" : "low";

  return {
    score,
    action,
    confidence,
    combinedHaircutBps,
    hardStops,
    factors,
    formula:
      "regime_score = average(signal_scores) - missing_penalty - hard_stop_penalty; combined_haircut_bps = sum(signal_haircuts)",
    sources: uniqueStrings([
      ...(input.marketContext?.sources ?? []),
      ...(input.tradeTape?.sources ?? []),
      ...(input.derivativesPressure?.sources ?? []),
      ...(input.optionsIv?.sources ?? []),
      ...(input.usdtBasis?.sources ?? []),
      ...(input.priceConsensus?.sources ?? []),
      ...(input.liquidityRadar?.sources ?? []),
      ...(input.venueLatency?.sources ?? []),
      ...(input.venueReliability?.sources ?? []),
      ...(input.leadLag?.sources ?? []),
    ]),
  };
}

function marketContextFactor(input?: Parameters<typeof buildExecutionRegimeFusion>[0]["marketContext"]): ExecutionRegimeFactor {
  const vol = input?.volatility?.realizedVolBpsPerSecond;
  if (!Number.isFinite(vol)) return missingFactor("market-context", "Market context");
  const sentiment = input?.sentiment?.value ?? 50;
  const score = clampScore(92 - (vol ?? 0) * 7 - Math.max(0, 25 - sentiment) * 0.4);
  const state = score >= 75 ? "positive" : score >= 55 ? "neutral" : score >= 35 ? "warning" : "critical";
  return {
    id: "market-context",
    label: "Market context",
    score,
    haircutBps: state === "positive" ? 0 : round(Math.max(0, (vol ?? 0) * 0.45), 2),
    state,
    evidence: `${(vol ?? 0).toFixed(2)} bps/s realized volatility; sentiment ${sentiment.toFixed(0)}/100.`,
  };
}

function tradeTapeFactor(input?: Parameters<typeof buildExecutionRegimeFusion>[0]["tradeTape"]): ExecutionRegimeFactor {
  const scoreRaw = input?.summary?.combinedScore;
  if (!Number.isFinite(scoreRaw)) return missingFactor("trade-tape", "Trade tape toxicity");
  const recommendation = input?.summary?.recommendation ?? "unknown";
  const score = clampScore(100 - (scoreRaw ?? 0));
  const state =
    recommendation === "halt" || score < 25
      ? "critical"
      : recommendation === "cap-size" || score < 55
        ? "warning"
        : "positive";
  return {
    id: "trade-tape",
    label: "Trade tape toxicity",
    score,
    haircutBps: state === "positive" ? 0 : round((scoreRaw ?? 0) / 25, 2),
    state,
    evidence: `toxicity ${(scoreRaw ?? 0).toFixed(0)}/100; policy ${recommendation}.`,
  };
}

function leadLagFactor(input?: Parameters<typeof buildExecutionRegimeFusion>[0]["leadLag"]): ExecutionRegimeFactor {
  const haircut = input?.summary?.executionHaircutBps;
  if (!Number.isFinite(haircut)) return missingFactor("lead-lag", "Lead-lag oracle");
  const policy = input?.summary?.policy ?? "unknown";
  const confidence = input?.summary?.confidence ?? "low";
  const baseScore = policy === "follow-leader" ? 88 : policy === "cap-size" ? 62 : policy === "halt" ? 22 : 48;
  const score = clampScore(baseScore + (confidence === "high" ? 8 : confidence === "medium" ? 0 : -10) - (haircut ?? 0) * 1.4);
  return {
    id: "lead-lag",
    label: "Lead-lag oracle",
    hardStopLabel: "Lead-lag execution halt",
    score,
    haircutBps: round(haircut ?? 0, 2),
    state: policy === "halt" ? "critical" : policy === "cap-size" ? "warning" : policy === "wait" ? "neutral" : "positive",
    evidence: `${policy}; leader ${input?.summary?.leaderVenue ?? "unknown"}; predicted ${input?.summary?.predictedDriftBps?.toFixed(2) ?? "0.00"} bps; divergence ${input?.summary?.divergenceBps?.toFixed(2) ?? "0.00"} bps.`,
  };
}

function derivativesFactor(input?: Parameters<typeof buildExecutionRegimeFusion>[0]["derivativesPressure"]): ExecutionRegimeFactor {
  const haircut = input?.summary?.spotExecutionHaircutBps;
  if (!Number.isFinite(haircut)) return missingFactor("derivatives-pressure", "Derivatives pressure");
  const riskState = input?.summary?.riskState ?? "unknown";
  const score = riskState === "halt" ? 10 : riskState === "caution" ? 58 : clampScore(95 - (haircut ?? 0) * 3);
  return {
    id: "derivatives-pressure",
    label: "Derivatives pressure",
    hardStopLabel: "Derivatives pressure halt",
    score,
    haircutBps: round(haircut ?? 0, 2),
    state: riskState === "halt" ? "critical" : riskState === "caution" ? "warning" : "positive",
    evidence: `${riskState}; ${(haircut ?? 0).toFixed(2)} bps spot haircut; direction ${input?.summary?.direction ?? "unknown"}.`,
  };
}

function optionsIvFactor(input?: Parameters<typeof buildExecutionRegimeFusion>[0]["optionsIv"]): ExecutionRegimeFactor {
  const haircut = input?.summary?.executionHaircutBps;
  if (!Number.isFinite(haircut)) return missingFactor("options-iv", "Options IV");
  const regime = input?.summary?.regime ?? "unknown";
  const score = regime === "fragile" ? 30 : regime === "elevated" ? 68 : clampScore(92 - (haircut ?? 0) * 2);
  return {
    id: "options-iv",
    label: "Options IV",
    score,
    haircutBps: round(haircut ?? 0, 2),
    state: regime === "fragile" ? "critical" : regime === "elevated" ? "warning" : "positive",
    evidence: `${regime}; IV ${input?.summary?.atmIvPct?.toFixed(1) ?? "?"}%; 1h expected move ${input?.summary?.expectedMove1hBps?.toFixed(1) ?? "?"} bps.`,
  };
}

function usdtBasisFactor(input?: Parameters<typeof buildExecutionRegimeFusion>[0]["usdtBasis"]): ExecutionRegimeFactor {
  const haircut = input?.summary?.dynamicHaircutBps;
  if (!Number.isFinite(haircut)) return missingFactor("usdt-basis", "USDT basis");
  const policy = input?.summary?.policy ?? "unknown";
  const score = policy === "cross-lane-halt" ? 15 : policy === "haircut-required" ? 62 : clampScore(96 - (haircut ?? 0));
  return {
    id: "usdt-basis",
    label: "USDT basis",
    hardStopLabel: "USDT cross-lane halt",
    score,
    haircutBps: round(haircut ?? 0, 2),
    state: policy === "cross-lane-halt" ? "critical" : policy === "haircut-required" ? "warning" : "positive",
    evidence: `${policy}; ${(haircut ?? 0).toFixed(2)} bps basis haircut.`,
  };
}

function priceConsensusFactor(input?: Parameters<typeof buildExecutionRegimeFusion>[0]["priceConsensus"]): ExecutionRegimeFactor {
  const maxPremium = input?.summary?.maxPremiumBps;
  if (!Number.isFinite(maxPremium)) return missingFactor("price-consensus", "Price consensus");
  const confidence = input?.summary?.confidence ?? "low";
  const outliers = input?.summary?.outlierCount ?? 0;
  const stale = input?.summary?.staleCount ?? 0;
  const score = clampScore((confidence === "high" ? 95 : confidence === "medium" ? 76 : 48) - outliers * 12 - stale * 10 - (maxPremium ?? 0) * 0.12);
  return {
    id: "price-consensus",
    label: "Price consensus",
    score,
    haircutBps: round(outliers * 2 + stale * 1.5 + Math.max(0, (maxPremium ?? 0) - 25) * 0.08, 2),
    state: score >= 75 ? "positive" : score >= 55 ? "neutral" : score >= 35 ? "warning" : "critical",
    evidence: `${confidence}; ${outliers} outliers; ${stale} stale; max premium ${(maxPremium ?? 0).toFixed(1)} bps.`,
  };
}

function liquidityFactor(input?: Parameters<typeof buildExecutionRegimeFusion>[0]["liquidityRadar"]): ExecutionRegimeFactor {
  const routes = input?.summary?.routeCount ?? 0;
  if (!routes) return missingFactor("liquidity-radar", "REST liquidity");
  const executable = input?.summary?.executableRoutes ?? 0;
  const ratio = executable / routes;
  const bestNet = input?.summary?.bestNetProfitUsd ?? 0;
  const score = clampScore(58 + ratio * 55 + (bestNet > 0 ? 12 : -8));
  return {
    id: "liquidity-radar",
    label: "REST liquidity",
    score,
    haircutBps: round(bestNet > 0 ? 0 : Math.min(8, Math.abs(bestNet) / 30), 2),
    state: score >= 75 ? "positive" : score >= 50 ? "neutral" : "warning",
    evidence: `${executable}/${routes} executable REST routes; best net ${bestNet.toFixed(2)} USD.`,
  };
}

function latencyFactor(input?: Parameters<typeof buildExecutionRegimeFusion>[0]["venueLatency"]): ExecutionRegimeFactor {
  const p95 = input?.summary?.medianP95Ms;
  if (!Number.isFinite(p95)) return missingFactor("venue-latency", "Venue latency");
  const score = clampScore(96 - Math.max(0, (p95 ?? 0) - 150) / 18);
  return {
    id: "venue-latency",
    label: "Venue latency",
    score,
    haircutBps: round(Math.max(0, (p95 ?? 0) - 250) / 250, 2),
    state: score >= 80 ? "positive" : score >= 60 ? "neutral" : score >= 40 ? "warning" : "critical",
    evidence: `median p95 ${Math.round(p95 ?? 0)}ms across public venues.`,
  };
}

function reliabilityFactor(input?: Parameters<typeof buildExecutionRegimeFusion>[0]["venueReliability"]): ExecutionRegimeFactor {
  const averageScore = input?.summary?.averageScore;
  if (!Number.isFinite(averageScore)) return missingFactor("venue-reliability", "Venue reliability");
  const policy = input?.summary?.policy ?? "unknown";
  const haircut = input?.summary?.totalHaircutBps ?? 0;
  const halted = input?.summary?.haltedVenues ?? 0;
  const capped = input?.summary?.cappedVenues ?? 0;
  return {
    id: "venue-reliability",
    label: "Venue reliability",
    hardStopLabel: "Venue operational halt",
    score: clampScore((averageScore ?? 0) - halted * 18 - capped * 4),
    haircutBps: round(haircut, 2),
    state: halted > 0 ? "critical" : capped > 0 || policy === "cap-degraded-venues" ? "warning" : "positive",
    evidence: `${policy}; avg score ${(averageScore ?? 0).toFixed(0)}/100; worst ${input?.summary?.worstVenue ?? "unknown"}; haircut ${haircut.toFixed(2)} bps.`,
  };
}

function missingFactor(id: string, label: string): ExecutionRegimeFactor {
  return {
    id,
    label,
    score: 35,
    haircutBps: 0,
    state: "missing",
    evidence: "signal not loaded",
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

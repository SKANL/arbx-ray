import type { TradeTapeToxicity, TradeTapeVenueSummary } from "./trade-tape";
import type { OpportunityDecision } from "./types";
import type { VenueLatencyRace, VenueLatencyScore } from "./venue-latency";

export type LatencyAlphaRacePolicy = "cross-now" | "cap-size" | "wait-for-edge" | "reject-race-lost";

export type LatencyAlphaRacePoint = {
  latencyMs: number;
  survivalProbability: number;
  expectedPnlUsd: number;
  liquiditySurvival: number;
};

export type LatencyAlphaRaceFactor = {
  label: string;
  value: number;
  unit: "ms" | "USD" | "probability" | "score" | "BTC/s";
  interpretation: string;
};

export type LatencyAlphaRace = {
  generatedAt: number;
  route: string;
  quoteAsset: string;
  curve: LatencyAlphaRacePoint[];
  factors: LatencyAlphaRaceFactor[];
  reasons: string[];
  summary: {
    policy: LatencyAlphaRacePolicy;
    ourRaceLatencyMs: number;
    competitorArrivalMs: number;
    edgeHalfLifeMs: number;
    aggressiveFlowBtcPerSecond: number;
    survivalProbability: number;
    expectedCaptureUsd: number;
    tailRiskUsd: number;
    raceScore: number;
  };
  equation: string;
};

const curveLatenciesMs = [25, 50, 100, 250, 500, 1_000, 2_000];

export function buildLatencyAlphaRace(input: {
  decision?: OpportunityDecision;
  venueLatency?: VenueLatencyRace;
  tradeTape?: TradeTapeToxicity;
  realizedVolBpsPerSecond?: number;
  observedAt?: number;
}): LatencyAlphaRace {
  const generatedAt = input.observedAt ?? Date.now();
  const decision = input.decision;
  if (!decision) return emptyRace(generatedAt);

  const buyLatency = findVenueLatency(input.venueLatency, decision.buyExchange);
  const sellLatency = findVenueLatency(input.venueLatency, decision.sellExchange);
  const ourRaceLatencyMs = Math.max(25, Math.max(buyLatency?.p95Ms ?? 650, sellLatency?.p95Ms ?? 650));
  const competitorArrivalMs = Math.max(15, Math.min(buyLatency?.p50Ms ?? 280, sellLatency?.p50Ms ?? 280, input.venueLatency?.summary.medianP95Ms ?? 280) * 0.72);
  const buyTape = findTapeVenue(input.tradeTape, decision.buyExchange);
  const sellTape = findTapeVenue(input.tradeTape, decision.sellExchange);
  const aggressiveFlowBtcPerSecond = estimateAdverseFlowBtcPerSecond(decision, buyTape, sellTape, input.tradeTape);
  const topDepthBtc = Math.max(0.001, Math.min(topFilledBtc(decision.buyFill.levelsUsed), topFilledBtc(decision.sellFill.levelsUsed), decision.tradeSizeBtc));
  const realizedVolBpsPerSecond = Math.max(0, input.realizedVolBpsPerSecond ?? input.venueLatency?.realizedVolBpsPerSecond ?? 6);
  const toxicityScore = input.tradeTape?.summary.combinedScore ?? averageScore([buyTape, sellTape]);
  const edgeHalfLifeMs = edgeHalfLife({
    topDepthBtc,
    aggressiveFlowBtcPerSecond,
    toxicityScore,
    realizedVolBpsPerSecond,
    netProfitUsd: decision.netProfitUsd,
  });
  const curve = curveLatenciesMs.map((latencyMs) =>
    racePoint({
      decision,
      latencyMs,
      edgeHalfLifeMs,
      topDepthBtc,
      aggressiveFlowBtcPerSecond,
      realizedVolBpsPerSecond,
    }),
  );
  const selected = racePoint({
    decision,
    latencyMs: ourRaceLatencyMs,
    edgeHalfLifeMs,
    topDepthBtc,
    aggressiveFlowBtcPerSecond,
    realizedVolBpsPerSecond,
  });
  const latencyDeficit = Math.max(0, ourRaceLatencyMs - competitorArrivalMs);
  const tailRiskUsd = tailRisk(decision, realizedVolBpsPerSecond, toxicityScore, latencyDeficit);
  const expectedCaptureUsd = round(selected.expectedPnlUsd - tailRiskUsd);
  const raceScore = clampScore(selected.survivalProbability * 68 + Math.max(0, expectedCaptureUsd) * 0.18 + Math.max(0, 30 - latencyDeficit / 20));
  const policy = choosePolicy({ decision, survivalProbability: selected.survivalProbability, expectedCaptureUsd, raceScore });
  const reasons = buildReasons({
    policy,
    ourRaceLatencyMs,
    competitorArrivalMs,
    aggressiveFlowBtcPerSecond,
    toxicityScore,
    expectedCaptureUsd,
    survivalProbability: selected.survivalProbability,
  });

  return {
    generatedAt,
    route: `${decision.buyExchange.toUpperCase()} -> ${decision.sellExchange.toUpperCase()}`,
    quoteAsset: decision.quoteAsset,
    curve,
    factors: [
      {
        label: "Our p95 race latency",
        value: round(ourRaceLatencyMs),
        unit: "ms",
        interpretation: "Worst measured public endpoint latency across both route venues.",
      },
      {
        label: "Competitor arrival estimate",
        value: round(competitorArrivalMs),
        unit: "ms",
        interpretation: "Proxy for faster bots watching the same venues.",
      },
      {
        label: "Edge half-life",
        value: round(edgeHalfLifeMs),
        unit: "ms",
        interpretation: "How quickly this edge decays under flow, depth, volatility, and toxicity.",
      },
      {
        label: "Adverse aggressive flow",
        value: round(aggressiveFlowBtcPerSecond, 4),
        unit: "BTC/s",
        interpretation: "Estimated flow consuming the same ask/bid liquidity the simulator needs.",
      },
      {
        label: "Expected capture",
        value: expectedCaptureUsd,
        unit: "USD",
        interpretation: "Net route P&L after survival probability and race tail risk.",
      },
      {
        label: "Race score",
        value: raceScore,
        unit: "score",
        interpretation: "Composite speed, survival, and expected-capture score.",
      },
    ],
    reasons,
    summary: {
      policy,
      ourRaceLatencyMs: round(ourRaceLatencyMs),
      competitorArrivalMs: round(competitorArrivalMs),
      edgeHalfLifeMs: round(edgeHalfLifeMs),
      aggressiveFlowBtcPerSecond: round(aggressiveFlowBtcPerSecond, 4),
      survivalProbability: round(selected.survivalProbability, 4),
      expectedCaptureUsd,
      tailRiskUsd: round(tailRiskUsd),
      raceScore,
    },
    equation:
      "survival_probability = exp(-latency_ms / edge_half_life_ms) * liquidity_survival; expected_capture = net_pnl * survival_probability - volatility_tail_risk",
  };
}

function emptyRace(generatedAt: number): LatencyAlphaRace {
  return {
    generatedAt,
    route: "waiting",
    quoteAsset: "USD",
    curve: [],
    factors: [],
    reasons: ["waiting for a simulated opportunity"],
    summary: {
      policy: "wait-for-edge",
      ourRaceLatencyMs: 0,
      competitorArrivalMs: 0,
      edgeHalfLifeMs: 0,
      aggressiveFlowBtcPerSecond: 0,
      survivalProbability: 0,
      expectedCaptureUsd: 0,
      tailRiskUsd: 0,
      raceScore: 0,
    },
    equation:
      "survival_probability = exp(-latency_ms / edge_half_life_ms) * liquidity_survival; expected_capture = net_pnl * survival_probability - volatility_tail_risk",
  };
}

function findVenueLatency(race: VenueLatencyRace | undefined, exchange: string): VenueLatencyScore | undefined {
  return race?.venues.find((venue) => normalize(venue.venue) === normalize(exchange));
}

function findTapeVenue(tape: TradeTapeToxicity | undefined, exchange: string): TradeTapeVenueSummary | undefined {
  return tape?.venues.find((venue) => normalize(venue.exchangeId) === normalize(exchange));
}

function estimateAdverseFlowBtcPerSecond(
  decision: OpportunityDecision,
  buyTape: TradeTapeVenueSummary | undefined,
  sellTape: TradeTapeVenueSummary | undefined,
  tape: TradeTapeToxicity | undefined,
): number {
  const buyAskConsumption = buyTape ? Math.max(0, buyTape.buyAggressorBtc) / Math.max(1, tape?.windowMs ?? 60_000) * 1_000 : 0.012;
  const sellBidConsumption = sellTape ? Math.max(0, sellTape.sellAggressorBtc) / Math.max(1, tape?.windowMs ?? 60_000) * 1_000 : 0.012;
  const sizePressure = Math.max(0.25, decision.tradeSizeBtc);
  const toxicMultiplier = tape?.summary.recommendation === "halt-fast-flow" ? 2.4 : tape?.summary.recommendation === "cap-size" ? 1.45 : 1;
  return (buyAskConsumption + sellBidConsumption) * sizePressure * toxicMultiplier;
}

function topFilledBtc(levels: Array<{ filledBtc: number }>): number {
  return Math.max(0.001, levels[0]?.filledBtc ?? 0.001);
}

function edgeHalfLife(input: {
  topDepthBtc: number;
  aggressiveFlowBtcPerSecond: number;
  toxicityScore: number;
  realizedVolBpsPerSecond: number;
  netProfitUsd: number;
}): number {
  const liquiditySeconds = input.topDepthBtc / Math.max(0.001, input.aggressiveFlowBtcPerSecond);
  const liquidityHalfLifeMs = liquiditySeconds * 1_000 * 0.69;
  const toxicityCompression = 1 + input.toxicityScore / 70;
  const volatilityCompression = 1 + input.realizedVolBpsPerSecond / 18;
  const edgeBoost = 1 + Math.max(0, input.netProfitUsd) / 180;
  return clamp((liquidityHalfLifeMs * edgeBoost) / (toxicityCompression * volatilityCompression), 60, 6_000);
}

function racePoint(input: {
  decision: OpportunityDecision;
  latencyMs: number;
  edgeHalfLifeMs: number;
  topDepthBtc: number;
  aggressiveFlowBtcPerSecond: number;
  realizedVolBpsPerSecond: number;
}): LatencyAlphaRacePoint {
  const consumedBtc = input.aggressiveFlowBtcPerSecond * (input.latencyMs / 1_000);
  const liquiditySurvival = clamp(1 - consumedBtc / Math.max(0.001, input.topDepthBtc), 0.02, 1);
  const survivalProbability = clamp(Math.exp(-input.latencyMs / Math.max(1, input.edgeHalfLifeMs)) * liquiditySurvival, 0.001, 0.999);
  const notionalUsd = Math.max(input.decision.buyFill.notional, input.decision.sellFill.notional);
  const driftCostUsd = notionalUsd * (input.realizedVolBpsPerSecond / 10_000) * (input.latencyMs / 1_000);
  return {
    latencyMs: input.latencyMs,
    survivalProbability: round(survivalProbability, 4),
    expectedPnlUsd: round(input.decision.netProfitUsd * survivalProbability - driftCostUsd),
    liquiditySurvival: round(liquiditySurvival, 4),
  };
}

function tailRisk(
  decision: OpportunityDecision,
  realizedVolBpsPerSecond: number,
  toxicityScore: number,
  latencyDeficitMs: number,
): number {
  const notionalUsd = Math.max(decision.buyFill.notional, decision.sellFill.notional);
  const volatilityTail = notionalUsd * (realizedVolBpsPerSecond / 10_000) * Math.sqrt(Math.max(0.001, latencyDeficitMs / 1_000));
  const toxicityTail = notionalUsd * (toxicityScore / 100) * 0.0009;
  return volatilityTail + toxicityTail;
}

function choosePolicy(input: {
  decision: OpportunityDecision;
  survivalProbability: number;
  expectedCaptureUsd: number;
  raceScore: number;
}): LatencyAlphaRacePolicy {
  if (input.decision.status !== "accepted") return "wait-for-edge";
  if (input.expectedCaptureUsd <= 0 || input.survivalProbability < 0.35 || input.raceScore < 38) return "reject-race-lost";
  if (input.survivalProbability < 0.58 || input.raceScore < 64) return "cap-size";
  return "cross-now";
}

function buildReasons(input: {
  policy: LatencyAlphaRacePolicy;
  ourRaceLatencyMs: number;
  competitorArrivalMs: number;
  aggressiveFlowBtcPerSecond: number;
  toxicityScore: number;
  expectedCaptureUsd: number;
  survivalProbability: number;
}): string[] {
  return [
    input.policy === "cross-now" ? "race edge survives measured latency" : "latency race requires caution",
    input.ourRaceLatencyMs > input.competitorArrivalMs * 2 ? "latency disadvantage versus competitor arrival estimate" : "latency inside competitive window",
    input.aggressiveFlowBtcPerSecond > 0.08 ? "aggressive flow can consume top-of-book liquidity" : "aggressive flow is not consuming depth quickly",
    input.toxicityScore >= 65 ? "trade tape toxicity compresses edge half-life" : "trade tape toxicity is manageable",
    input.expectedCaptureUsd > 0 ? `expected capture ${money(input.expectedCaptureUsd)}` : "expected capture is negative after race tail risk",
    `survival probability ${(input.survivalProbability * 100).toFixed(1)}%`,
  ];
}

function averageScore(values: Array<TradeTapeVenueSummary | undefined>): number {
  const scores = values.filter((value): value is TradeTapeVenueSummary => Boolean(value)).map((value) => value.toxicityScore);
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 35;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function money(value: number): string {
  return `$${round(value).toFixed(2)}`;
}

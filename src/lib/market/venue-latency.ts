export type VenueLatencySample = {
  ok: boolean;
  ms: number;
  status?: number;
  error?: string;
};

export type VenueLatencyProbe = {
  venue: string;
  label: string;
  endpoint: string;
  samples: VenueLatencySample[];
};

export type VenueLatencyScore = {
  venue: string;
  label: string;
  endpoint: string;
  samples: VenueLatencySample[];
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  jitterMs: number;
  availabilityPct: number;
  latencyPenaltyUsd: number;
  score: number;
  status: "pass" | "watch" | "fail";
  reason: string;
};

export type VenueLatencyRace = {
  generatedAt: number;
  latencyBudgetMs: number;
  notionalUsd: number;
  realizedVolBpsPerSecond: number;
  venues: VenueLatencyScore[];
  summary: {
    venueCount: number;
    fastestVenue: string;
    lowestPenaltyUsd: number;
    degradedVenues: number;
    medianP95Ms: number;
    bestScore: number;
  };
  sources: string[];
  errors: string[];
};

export function buildVenueLatencyRace(input: {
  probes: VenueLatencyProbe[];
  latencyBudgetMs?: number;
  notionalUsd?: number;
  realizedVolBpsPerSecond?: number;
  generatedAt?: number;
}): VenueLatencyRace {
  const latencyBudgetMs = input.latencyBudgetMs ?? 900;
  const notionalUsd = input.notionalUsd ?? 50_000;
  const realizedVolBpsPerSecond = input.realizedVolBpsPerSecond ?? 8;
  const venues = input.probes
    .map((probe) => scoreProbe(probe, latencyBudgetMs, notionalUsd, realizedVolBpsPerSecond))
    .sort((a, b) => b.score - a.score || a.p95Ms - b.p95Ms);
  const fastest = [...venues].sort((a, b) => a.p95Ms - b.p95Ms)[0];
  const p95Values = venues.map((venue) => venue.p95Ms).sort((a, b) => a - b);

  return {
    generatedAt: input.generatedAt ?? Date.now(),
    latencyBudgetMs,
    notionalUsd,
    realizedVolBpsPerSecond,
    venues,
    summary: {
      venueCount: venues.length,
      fastestVenue: fastest?.venue ?? "unavailable",
      lowestPenaltyUsd: Math.min(...venues.map((venue) => venue.latencyPenaltyUsd), 0),
      degradedVenues: venues.filter((venue) => venue.status !== "pass").length,
      medianP95Ms: percentile(p95Values, 0.5),
      bestScore: venues[0]?.score ?? 0,
    },
    sources: uniqueStrings(input.probes.map((probe) => probe.endpoint)),
    errors: input.probes.flatMap((probe) =>
      probe.samples
        .filter((sample) => !sample.ok)
        .map((sample) => `${probe.venue}: ${sample.error ?? sample.status ?? "request failed"}`),
    ),
  };
}

function scoreProbe(
  probe: VenueLatencyProbe,
  latencyBudgetMs: number,
  notionalUsd: number,
  realizedVolBpsPerSecond: number,
): VenueLatencyScore {
  const samples = probe.samples.length > 0 ? probe.samples : [{ ok: false, ms: latencyBudgetMs, error: "no samples" }];
  const okSamples = samples.filter((sample) => sample.ok && Number.isFinite(sample.ms) && sample.ms >= 0);
  const latencies = (okSamples.length > 0 ? okSamples : samples).map((sample) => Math.max(0, sample.ms)).sort((a, b) => a - b);
  const p50Ms = percentile(latencies, 0.5);
  const p95Ms = percentile(latencies, 0.95);
  const maxMs = latencies[latencies.length - 1] ?? 0;
  const jitterMs = Math.max(0, p95Ms - p50Ms);
  const availabilityPct = (okSamples.length / samples.length) * 100;
  const latencyPenaltyUsd = notionalUsd * (realizedVolBpsPerSecond / 10_000) * (p95Ms / 1_000);
  const failureRate = 1 - availabilityPct / 100;
  const score = clamp(
    100 -
      (p95Ms / Math.max(1, latencyBudgetMs)) * 45 -
      (jitterMs / Math.max(1, latencyBudgetMs)) * 20 -
      failureRate * 55,
    0,
    100,
  );
  const status = score >= 75 ? "pass" : score >= 50 ? "watch" : "fail";

  return {
    venue: probe.venue,
    label: probe.label,
    endpoint: probe.endpoint,
    samples,
    p50Ms,
    p95Ms,
    maxMs,
    jitterMs,
    availabilityPct,
    latencyPenaltyUsd,
    score,
    status,
    reason: `${probe.label} p95 ${p95Ms.toFixed(0)}ms, jitter ${jitterMs.toFixed(0)}ms, availability ${availabilityPct.toFixed(0)}%`,
  };
}

function percentile(sortedValues: number[], percentileValue: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1),
  );
  return sortedValues[index] ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

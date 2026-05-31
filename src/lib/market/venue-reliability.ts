import type { ExchangeId, FeedHealth } from "./types";

export type ReliabilityVenueId =
  | "coinbase"
  | "kraken"
  | "gemini"
  | "bitstamp"
  | "bitfinex"
  | "binance"
  | "okx"
  | "bybit";

export type VenueStatusIndicator = "none" | "minor" | "major" | "critical" | "maintenance" | "unknown";

export type VenueStatusSnapshot = {
  venue: ReliabilityVenueId;
  label: string;
  indicator: VenueStatusIndicator;
  description: string;
  updatedAt?: number;
  fetchedAt: number;
  source: string;
};

export type VenueReliabilityScore = VenueStatusSnapshot & {
  operationalScore: number;
  statusPenaltyBps: number;
  latencyPenaltyBps: number;
  feedPenaltyBps: number;
  totalHaircutBps: number;
  latencyP95Ms?: number;
  feedStatus?: FeedHealth["status"];
  policy: "allow" | "cap-size" | "halt";
  reasons: string[];
};

export type VenueReliabilityOracle = {
  generatedAt: number;
  venues: VenueReliabilityScore[];
  summary: {
    venueCount: number;
    healthyVenues: number;
    cappedVenues: number;
    haltedVenues: number;
    averageScore: number;
    worstVenue?: ReliabilityVenueId;
    worstScore: number;
    totalHaircutBps: number;
    policy: "allow-routing" | "cap-degraded-venues" | "exclude-risky-venues";
  };
  equation: string;
  sources: string[];
  errors: string[];
};

export function parseStatusPageStatus(
  venue: ReliabilityVenueId,
  label: string,
  source: string,
  payload: unknown,
  fetchedAt = Date.now(),
): VenueStatusSnapshot | undefined {
  if (!isRecord(payload) || !isRecord(payload.status)) return undefined;
  const indicator = normalizeIndicator(payload.status.indicator);
  const description = typeof payload.status.description === "string" ? payload.status.description : indicator;
  const updatedAt =
    isRecord(payload.page) && typeof payload.page.updated_at === "string"
      ? Date.parse(payload.page.updated_at)
      : undefined;
  return {
    venue,
    label,
    indicator,
    description,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : undefined,
    fetchedAt,
    source,
  };
}

export function buildVenueReliabilityOracle(input: {
  statuses: VenueStatusSnapshot[];
  latency?: {
    venues?: Array<{ venue: string; p95Ms?: number; score?: number; status?: string }>;
  };
  health?: FeedHealth[];
  observedAt?: number;
  errors?: string[];
}): VenueReliabilityOracle {
  const generatedAt = input.observedAt ?? Date.now();
  const venues = input.statuses
    .map((status) => scoreVenue(status, input.latency, input.health, generatedAt))
    .sort((a, b) => a.operationalScore - b.operationalScore || b.totalHaircutBps - a.totalHaircutBps);
  const venueCount = venues.length;
  const cappedVenues = venues.filter((venue) => venue.policy === "cap-size").length;
  const haltedVenues = venues.filter((venue) => venue.policy === "halt").length;
  const healthyVenues = venues.filter((venue) => venue.policy === "allow").length;
  const averageScore = venueCount
    ? round(venues.reduce((sum, venue) => sum + venue.operationalScore, 0) / venueCount)
    : 0;
  const totalHaircutBps = round(venues.reduce((sum, venue) => sum + venue.totalHaircutBps, 0));
  const worst = venues[0];
  const policy =
    haltedVenues > 0
      ? "exclude-risky-venues"
      : cappedVenues > 0 || averageScore < 82
        ? "cap-degraded-venues"
        : "allow-routing";

  return {
    generatedAt,
    venues,
    summary: {
      venueCount,
      healthyVenues,
      cappedVenues,
      haltedVenues,
      averageScore,
      worstVenue: worst?.venue,
      worstScore: worst?.operationalScore ?? 0,
      totalHaircutBps,
      policy,
    },
    equation:
      "operational_score = status_score - latency_penalty - feed_penalty - stale_status_penalty; total_haircut_bps = status_penalty + latency_penalty + feed_penalty",
    sources: uniqueStrings(input.statuses.map((status) => status.source)),
    errors: input.errors ?? [],
  };
}

function scoreVenue(
  status: VenueStatusSnapshot,
  latency: Parameters<typeof buildVenueReliabilityOracle>[0]["latency"],
  health: FeedHealth[] | undefined,
  generatedAt: number,
): VenueReliabilityScore {
  const latencyVenue = latency?.venues?.find((venue) => venue.venue === status.venue);
  const feed = health?.find((item) => item.exchangeId === status.venue);
  const statusScore = statusScoreFor(status.indicator);
  const statusPenaltyBps = statusPenaltyFor(status.indicator);
  const staleStatusPenalty = generatedAt - status.fetchedAt > 10 * 60_000 ? 12 : 0;
  const latencyP95Ms = latencyVenue?.p95Ms;
  const latencyPenaltyBps = Number.isFinite(latencyP95Ms)
    ? round(Math.max(0, ((latencyP95Ms ?? 0) - 250) / 180), 2)
    : 0;
  const latencyScorePenalty = Number.isFinite(latencyVenue?.score) ? Math.max(0, 80 - (latencyVenue?.score ?? 0)) * 0.35 : 0;
  const feedPenaltyBps =
    feed?.status === "error" ? 9 : feed?.status === "stale" ? 5 : feed?.status === "connecting" ? 3 : 0;
  const feedScorePenalty =
    feed?.status === "error" ? 30 : feed?.status === "stale" ? 18 : feed?.status === "connecting" ? 8 : 0;
  const operationalScore = clampScore(statusScore - latencyScorePenalty - feedScorePenalty - staleStatusPenalty);
  const totalHaircutBps = round(statusPenaltyBps + latencyPenaltyBps + feedPenaltyBps, 2);
  const reasons = [
    ...(status.indicator !== "none" ? [`public status ${status.indicator}`] : []),
    ...(Number.isFinite(latencyP95Ms) && (latencyP95Ms ?? 0) > 900 ? ["slow public endpoint latency"] : []),
    ...(feed?.status && feed.status !== "live" ? [`feed ${feed.status}`] : []),
    ...(staleStatusPenalty > 0 ? ["stale status evidence"] : []),
  ];
  const policy =
    status.indicator === "critical" || operationalScore < 45 || feed?.status === "error"
      ? "halt"
      : status.indicator !== "none" || operationalScore < 78 || totalHaircutBps >= 4
        ? "cap-size"
        : "allow";

  return {
    ...status,
    operationalScore,
    statusPenaltyBps,
    latencyPenaltyBps,
    feedPenaltyBps,
    totalHaircutBps,
    latencyP95Ms,
    feedStatus: feed?.status,
    policy,
    reasons,
  };
}

function statusScoreFor(indicator: VenueStatusIndicator): number {
  if (indicator === "none") return 96;
  if (indicator === "minor") return 74;
  if (indicator === "maintenance") return 68;
  if (indicator === "major") return 42;
  if (indicator === "critical") return 12;
  return 55;
}

function statusPenaltyFor(indicator: VenueStatusIndicator): number {
  if (indicator === "none") return 0;
  if (indicator === "minor") return 2;
  if (indicator === "maintenance") return 3.5;
  if (indicator === "major") return 8;
  if (indicator === "critical") return 18;
  return 5;
}

function normalizeIndicator(value: unknown): VenueStatusIndicator {
  if (value === "none" || value === "minor" || value === "major" || value === "critical" || value === "maintenance") {
    return value;
  }
  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

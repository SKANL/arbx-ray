export type DashboardPublicEndpointKey =
  | "marketContext"
  | "settlementRisk"
  | "cashCarryLab"
  | "venueIntelligence"
  | "derivativesPressure"
  | "optionsIv"
  | "liquidityRadar"
  | "priceConsensus"
  | "tradeTape"
  | "leadLag"
  | "usdtBasis"
  | "mexicoCorridor"
  | "venueLatency"
  | "venueReliability"
  | "historicalReplay"
  | "triangularLab";

export type DashboardPublicEndpoint = {
  key: DashboardPublicEndpointKey;
  path: `/api/${string}`;
  intervalMs: number | null;
};

export const DASHBOARD_PUBLIC_ENDPOINTS = [
  { key: "marketContext", path: "/api/market-context", intervalMs: 60_000 },
  { key: "settlementRisk", path: "/api/settlement-risk", intervalMs: 60_000 },
  { key: "cashCarryLab", path: "/api/cash-carry", intervalMs: 60_000 },
  { key: "venueIntelligence", path: "/api/venue-intelligence", intervalMs: 120_000 },
  { key: "derivativesPressure", path: "/api/derivatives-pressure", intervalMs: 45_000 },
  { key: "optionsIv", path: "/api/options-iv", intervalMs: 90_000 },
  { key: "liquidityRadar", path: "/api/liquidity-radar", intervalMs: 90_000 },
  { key: "priceConsensus", path: "/api/price-consensus", intervalMs: 45_000 },
  { key: "tradeTape", path: "/api/trade-tape", intervalMs: 30_000 },
  { key: "leadLag", path: "/api/lead-lag", intervalMs: 30_000 },
  { key: "usdtBasis", path: "/api/usdt-basis", intervalMs: 45_000 },
  { key: "mexicoCorridor", path: "/api/mexico-corridor", intervalMs: 45_000 },
  { key: "venueLatency", path: "/api/venue-latency", intervalMs: 60_000 },
  { key: "venueReliability", path: "/api/venue-reliability", intervalMs: 90_000 },
  { key: "historicalReplay", path: "/api/historical-replay", intervalMs: null },
  { key: "triangularLab", path: "/api/triangular-lab", intervalMs: 45_000 },
] as const satisfies readonly DashboardPublicEndpoint[];

export function findDashboardPublicEndpoint(key: DashboardPublicEndpointKey): DashboardPublicEndpoint {
  const endpoint = DASHBOARD_PUBLIC_ENDPOINTS.find((item) => item.key === key);
  if (!endpoint) {
    throw new Error(`Unknown dashboard public endpoint: ${key}`);
  }
  return endpoint;
}

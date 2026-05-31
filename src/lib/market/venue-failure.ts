import type { QuoteAsset, SimulatedFill, WalletState } from "./types";
import type { VenueReliabilityOracle, VenueReliabilityScore } from "./venue-reliability";

export type FailureGameDecision = {
  status: "accepted" | "rejected";
  buyExchange: string;
  sellExchange: string;
  quoteAsset: QuoteAsset;
  tradeSizeBtc: number;
  buyFill: Pick<SimulatedFill, "vwap" | "filledBtc" | "notional" | "complete" | "levelsUsed">;
  sellFill: Pick<SimulatedFill, "vwap" | "filledBtc" | "notional" | "complete" | "levelsUsed">;
  netProfitUsd: number;
};

export type VenueFailureScenarioId = "buy-venue-outage" | "sell-venue-outage" | "worst-venue-outage";

export type VenueFailureRecoveryAction =
  | "route-to-backup-venue"
  | "cap-route-size"
  | "halt-and-internalize"
  | "continue-with-monitoring";

export type VenueFailureScenario = {
  id: VenueFailureScenarioId;
  label: string;
  failedVenue: string;
  failedVenuePolicy: VenueReliabilityScore["policy"] | "unknown";
  failedVenueScore: number;
  recoveryAction: VenueFailureRecoveryAction;
  backupVenue?: string;
  unwindPnlUsd: number;
  trappedCapitalUsd: number;
  missedEdgeUsd: number;
  emergencyPriceUsd: number;
  haircutBps: number;
  riskScore: number;
  reasons: string[];
};

export type VenueFailureWarGame = {
  generatedAt: number;
  scenarios: VenueFailureScenario[];
  summary: {
    policy: "standby" | "route-allowed" | "failover-required" | "cap-size" | "halt-route";
    worstScenario?: VenueFailureScenarioId;
    worstLossUsd: number;
    trappedCapitalUsd: number;
    failoverVenues: string[];
    haltedScenarios: number;
  };
  equation: string;
};

export function buildVenueFailureWarGame(input: {
  decision?: FailureGameDecision;
  wallets: WalletState;
  reliability?: VenueReliabilityOracle;
  btcUsd?: number;
  settlementPenaltyBps?: number;
  observedAt?: number;
}): VenueFailureWarGame {
  const generatedAt = input.observedAt ?? Date.now();
  const decision = input.decision;
  if (!decision || decision.status !== "accepted" || decision.tradeSizeBtc <= 0) {
    return {
      generatedAt,
      scenarios: [],
      summary: {
        policy: "standby",
        worstLossUsd: 0,
        trappedCapitalUsd: 0,
        failoverVenues: [],
        haltedScenarios: 0,
      },
      equation:
        "unwind_pnl = (emergency_exit_price - entry_vwap) * filled_btc; emergency_exit_price = min(reference_btc_usd, planned_exit_vwap) * (1 - failure_haircut_bps / 10000)",
    };
  }

  const btcUsd = positiveNumber(input.btcUsd) || decision.buyFill.vwap || decision.sellFill.vwap || 70_000;
  const settlementPenaltyBps = Math.max(0, input.settlementPenaltyBps ?? 0);
  const reliabilityByVenue = buildReliabilityMap(input.reliability?.venues ?? []);
  const buyVenue = venueScore(decision.buyExchange, reliabilityByVenue);
  const sellVenue = venueScore(decision.sellExchange, reliabilityByVenue);
  const worstVenue = input.reliability?.summary.worstVenue;
  const worstVenueId =
    worstVenue && worstVenue !== decision.buyExchange && worstVenue !== decision.sellExchange
      ? String(worstVenue)
      : sellVenue.policy === "halt"
        ? decision.sellExchange
        : decision.buyExchange;

  const scenarios = [
    buildScenario({
      id: "buy-venue-outage",
      failedVenue: decision.buyExchange,
      failedVenueLabel: "Buy venue outage before fill settlement",
      venue: buyVenue,
      decision,
      wallets: input.wallets,
      btcUsd,
      settlementPenaltyBps,
      reliabilityByVenue,
      side: "buy",
    }),
    buildScenario({
      id: "sell-venue-outage",
      failedVenue: decision.sellExchange,
      failedVenueLabel: "Sell venue outage after buy leg",
      venue: sellVenue,
      decision,
      wallets: input.wallets,
      btcUsd,
      settlementPenaltyBps,
      reliabilityByVenue,
      side: "sell",
    }),
    buildScenario({
      id: "worst-venue-outage",
      failedVenue: worstVenueId,
      failedVenueLabel: "Worst public-status venue outage",
      venue: venueScore(worstVenueId, reliabilityByVenue),
      decision,
      wallets: input.wallets,
      btcUsd,
      settlementPenaltyBps,
      reliabilityByVenue,
      side: worstVenueId === decision.buyExchange ? "buy" : "sell",
    }),
  ];

  const worst = scenarios
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore || lossMagnitude(b) - lossMagnitude(a))[0];
  const haltedScenarios = scenarios.filter((scenario) => scenario.recoveryAction === "halt-and-internalize").length;
  const failoverVenues = uniqueStrings(scenarios.map((scenario) => scenario.backupVenue).filter(Boolean) as string[]);
  const routeVenuesHalted = buyVenue.policy === "halt" && sellVenue.policy === "halt";
  const policy =
    routeVenuesHalted || haltedScenarios >= 2
      ? "halt-route"
      : failoverVenues.length > 0
        ? "failover-required"
        : scenarios.some((scenario) => scenario.recoveryAction === "cap-route-size")
          ? "cap-size"
          : "route-allowed";

  return {
    generatedAt,
    scenarios,
    summary: {
      policy,
      worstScenario: worst?.id,
      worstLossUsd: round(worst ? -lossMagnitude(worst) : 0),
      trappedCapitalUsd: round(scenarios.reduce((sum, scenario) => sum + scenario.trappedCapitalUsd, 0)),
      failoverVenues,
      haltedScenarios,
    },
    equation:
      "unwind_pnl = (emergency_exit_price - entry_vwap) * filled_btc; emergency_exit_price = min(reference_btc_usd, planned_exit_vwap) * (1 - (settlement_penalty_bps + venue_haircut_bps + failover_haircut_bps) / 10000); trapped_capital = blocked_asset_units * reference_price",
  };
}

function buildScenario(input: {
  id: VenueFailureScenarioId;
  failedVenue: string;
  failedVenueLabel: string;
  venue: VenueFailureScore;
  decision: FailureGameDecision;
  wallets: WalletState;
  btcUsd: number;
  settlementPenaltyBps: number;
  reliabilityByVenue: Map<string, VenueReliabilityScore>;
  side: "buy" | "sell";
}): VenueFailureScenario {
  const size = Math.min(input.decision.tradeSizeBtc, input.decision.buyFill.filledBtc, input.decision.sellFill.filledBtc);
  const backup = findBackupVenue({
    failedVenue: input.failedVenue,
    primaryVenues: [input.decision.buyExchange, input.decision.sellExchange],
    wallets: input.wallets,
    sizeBtc: size,
    reliabilityByVenue: input.reliabilityByVenue,
  });
  const routeVenue = input.failedVenue === input.decision.buyExchange || input.failedVenue === input.decision.sellExchange;
  const failureHaircutBps =
    input.settlementPenaltyBps +
    input.venue.totalHaircutBps +
    (input.venue.policy === "halt" ? 18 : input.venue.policy === "cap-size" ? 8 : 4) +
    (backup ? 8 : 18);
  const emergencyPriceUsd =
    input.side === "sell"
      ? Math.min(input.btcUsd, input.decision.sellFill.vwap) * (1 - failureHaircutBps / 10_000)
      : input.btcUsd * (1 - failureHaircutBps / 10_000);
  const unwindPnlUsd =
    input.side === "sell"
      ? (emergencyPriceUsd - input.decision.buyFill.vwap) * size
      : -Math.max(0, input.decision.netProfitUsd);
  const trappedCapitalUsd =
    input.side === "sell" && !backup
      ? size * input.btcUsd
      : input.side === "buy" && routeVenue
        ? input.decision.buyFill.notional
        : 0;
  const missedEdgeUsd = input.side === "buy" ? Math.max(0, input.decision.netProfitUsd) : 0;
  const recoveryAction = pickRecoveryAction(input.venue, backup, routeVenue);
  const reasons = [
    `${input.failedVenue} policy ${input.venue.policy}`,
    ...(input.venue.reasons.length ? input.venue.reasons : ["no public incident reason"]),
    ...(backup ? [`backup inventory available at ${backup.venue}`] : ["no backup venue with enough prefunded BTC"]),
    ...(unwindPnlUsd < 0 ? ["emergency unwind is loss-making after haircuts"] : []),
    ...(trappedCapitalUsd > 0 ? ["capital can be stranded if settlement or venue access fails"] : []),
  ];
  const riskScore = clampScore(
    (input.venue.policy === "halt" ? 44 : input.venue.policy === "cap-size" ? 24 : 10) +
      Math.min(28, Math.abs(unwindPnlUsd) / Math.max(1, Math.abs(input.decision.netProfitUsd)) * 9) +
      Math.min(22, trappedCapitalUsd / Math.max(1, input.decision.buyFill.notional) * 22) +
      (backup ? -10 : 10),
  );

  return {
    id: input.id,
    label: input.failedVenueLabel,
    failedVenue: input.failedVenue,
    failedVenuePolicy: input.venue.policy,
    failedVenueScore: input.venue.operationalScore,
    recoveryAction,
    backupVenue: backup?.venue,
    unwindPnlUsd: round(unwindPnlUsd),
    trappedCapitalUsd: round(trappedCapitalUsd),
    missedEdgeUsd: round(missedEdgeUsd),
    emergencyPriceUsd: round(emergencyPriceUsd),
    haircutBps: round(failureHaircutBps),
    riskScore,
    reasons,
  };
}

type VenueFailureScore = Pick<
  VenueReliabilityScore,
  "venue" | "policy" | "operationalScore" | "totalHaircutBps" | "reasons"
>;

function venueScore(venue: string, reliabilityByVenue: Map<string, VenueReliabilityScore>): VenueFailureScore {
  const score = reliabilityByVenue.get(venue);
  if (score) return score;
  return {
    venue: venue as never,
    policy: "allow",
    operationalScore: 82,
    totalHaircutBps: 1,
    reasons: ["no public reliability record loaded"],
  };
}

function buildReliabilityMap(venues: VenueReliabilityScore[]): Map<string, VenueReliabilityScore> {
  const entries = new Map<string, VenueReliabilityScore>();
  for (const venue of venues) {
    const current = entries.get(venue.venue);
    if (!current || severityRank(venue.policy) > severityRank(current.policy)) {
      entries.set(venue.venue, venue);
    }
  }
  return entries;
}

function findBackupVenue(input: {
  failedVenue: string;
  primaryVenues: string[];
  wallets: WalletState;
  sizeBtc: number;
  reliabilityByVenue: Map<string, VenueReliabilityScore>;
}): { venue: string; btc: number; score: number } | undefined {
  return Object.entries(input.wallets)
    .filter(([venue, balance]) => venue !== input.failedVenue && !input.primaryVenues.includes(venue) && balance.BTC >= input.sizeBtc)
    .map(([venue, balance]) => {
      const reliability = venueScore(venue, input.reliabilityByVenue);
      return { venue, btc: balance.BTC, score: reliability.operationalScore, policy: reliability.policy };
    })
    .filter((candidate) => candidate.policy !== "halt")
    .sort((a, b) => severityRank(a.policy) - severityRank(b.policy) || b.score - a.score || b.btc - a.btc)[0];
}

function pickRecoveryAction(
  venue: VenueFailureScore,
  backup: { venue: string } | undefined,
  routeVenue: boolean,
): VenueFailureRecoveryAction {
  if (backup && routeVenue) return "route-to-backup-venue";
  if (venue.policy === "halt" || !backup) return "halt-and-internalize";
  if (venue.policy === "cap-size") return "cap-route-size";
  return "continue-with-monitoring";
}

function lossMagnitude(scenario: VenueFailureScenario): number {
  return Math.max(0, -scenario.unwindPnlUsd) + scenario.trappedCapitalUsd + scenario.missedEdgeUsd;
}

function severityRank(policy: VenueReliabilityScore["policy"]): number {
  if (policy === "halt") return 3;
  if (policy === "cap-size") return 2;
  return 1;
}

function positiveNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
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

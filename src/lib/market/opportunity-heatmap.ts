import type { HistoricalReplay } from "./historical";

export type OpportunityEdgeTier = "micro" | "tradable" | "strong" | "elite";

export type OpportunityHeatmapCell = {
  hourUtc: number;
  edgeTier: OpportunityEdgeTier;
  tradeCount: number;
  totalPnlUsd: number;
  averagePnlUsd: number;
  averageSpreadBps: number;
  winRate: number;
  opportunityDensity: number;
};

export type OpportunityHeatmap = {
  generatedAt: number;
  cells: OpportunityHeatmapCell[];
  summary: {
    policy: "insufficient-history" | "opportunistic" | "pattern-detected";
    opportunityCount: number;
    hotHourUtc?: number;
    hotTier?: OpportunityEdgeTier;
    concentrationScore: number;
    bestCellPnlUsd: number;
    bestCellWinRate: number;
  };
  equation: string;
};

const tiers: Array<{ id: OpportunityEdgeTier; min: number; max: number }> = [
  { id: "micro", min: 0, max: 8 },
  { id: "tradable", min: 8, max: 18 },
  { id: "strong", min: 18, max: 32 },
  { id: "elite", min: 32, max: Number.POSITIVE_INFINITY },
];

export function buildOpportunityHeatmap(input: { replay?: HistoricalReplay; generatedAt?: number }): OpportunityHeatmap {
  const generatedAt = input.generatedAt ?? Date.now();
  const trades = input.replay?.trades ?? [];
  const cells = buildCells(trades);
  const activeCells = cells.filter((cell) => cell.tradeCount > 0);
  const bestCell = activeCells
    .slice()
    .sort(
      (a, b) =>
        b.opportunityDensity - a.opportunityDensity ||
        b.totalPnlUsd - a.totalPnlUsd ||
        tierRank(b.edgeTier) - tierRank(a.edgeTier),
    )[0];
  const opportunityCount = trades.length;
  const topCellTrades = bestCell?.tradeCount ?? 0;
  const concentrationScore =
    opportunityCount > 0
      ? round(
          Math.min(100, (topCellTrades / opportunityCount) * 70 + Math.min(30, (bestCell?.averageSpreadBps ?? 0) * 0.8)),
        )
      : 0;
  const policy =
    opportunityCount === 0
      ? "insufficient-history"
      : concentrationScore >= 40 && topCellTrades >= 2
        ? "pattern-detected"
        : "opportunistic";

  return {
    generatedAt,
    cells,
    summary: {
      policy,
      opportunityCount,
      hotHourUtc: bestCell?.hourUtc,
      hotTier: bestCell?.edgeTier,
      concentrationScore,
      bestCellPnlUsd: round(bestCell?.totalPnlUsd ?? 0),
      bestCellWinRate: round(bestCell?.winRate ?? 0, 4),
    },
    equation:
      "opportunity_density = normalized(trade_count) * 0.45 + normalized(total_pnl_usd) * 0.35 + win_rate * 0.20; concentration_score = hot_cell_share * 70 + average_spread_bps * 0.8",
  };
}

function buildCells(trades: HistoricalReplay["trades"]): OpportunityHeatmapCell[] {
  const maxCountByCell = new Map<string, number>();
  const raw = new Map<string, HistoricalReplay["trades"]>();
  for (let hour = 0; hour < 24; hour += 1) {
    for (const tier of tiers) {
      raw.set(key(hour, tier.id), []);
    }
  }
  for (const trade of trades) {
    const hour = new Date(trade.timestamp).getUTCHours();
    const tier = classifyTier(trade.spreadBps);
    const id = key(hour, tier);
    raw.set(id, [...(raw.get(id) ?? []), trade]);
  }
  for (const [id, rows] of raw) {
    maxCountByCell.set(id, rows.length);
  }
  const maxCount = Math.max(1, ...maxCountByCell.values());
  const maxPnl = Math.max(1, ...Array.from(raw.values()).map((rows) => rows.reduce((sum, trade) => sum + trade.netProfitUsd, 0)));

  return Array.from(raw.entries()).map(([id, rows]) => {
    const [hourText, tier] = id.split(":") as [string, OpportunityEdgeTier];
    const tradeCount = rows.length;
    const totalPnlUsd = rows.reduce((sum, trade) => sum + trade.netProfitUsd, 0);
    const winners = rows.filter((trade) => trade.netProfitUsd > 0).length;
    const averageSpreadBps = tradeCount ? rows.reduce((sum, trade) => sum + trade.spreadBps, 0) / tradeCount : 0;
    const winRate = tradeCount ? winners / tradeCount : 0;
    const opportunityDensity = round((tradeCount / maxCount) * 0.45 + (Math.max(0, totalPnlUsd) / maxPnl) * 0.35 + winRate * 0.2, 4);
    return {
      hourUtc: Number(hourText),
      edgeTier: tier,
      tradeCount,
      totalPnlUsd: round(totalPnlUsd),
      averagePnlUsd: tradeCount ? round(totalPnlUsd / tradeCount) : 0,
      averageSpreadBps: round(averageSpreadBps, 2),
      winRate: round(winRate, 4),
      opportunityDensity,
    };
  });
}

function classifyTier(spreadBps: number): OpportunityEdgeTier {
  return tiers.find((tier) => spreadBps >= tier.min && spreadBps < tier.max)?.id ?? "elite";
}

function tierRank(tier: OpportunityEdgeTier): number {
  if (tier === "elite") return 4;
  if (tier === "strong") return 3;
  if (tier === "tradable") return 2;
  return 1;
}

function key(hour: number, tier: OpportunityEdgeTier): string {
  return `${hour}:${tier}`;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

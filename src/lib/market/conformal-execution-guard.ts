import type { HistoricalReplay, HistoricalTrade } from "./historical";
import type { OpportunityDecision } from "./types";

export type ConformalExecutionPolicy = "execute" | "cap-size" | "wait" | "insufficient-history";

export type ConformalCalibrationPoint = {
  timestamp: number;
  route: string;
  netProfitUsd: number;
  rollingMedianUsd: number;
  residualUsd: number;
  spreadBps: number;
};

export type ConformalExecutionGuard = {
  summary: {
    policy: ConformalExecutionPolicy;
    targetCoverage: number;
    sampleCount: number;
    quantileResidualUsd: number;
    expectedNetUsd: number;
    lowerBoundUsd: number;
    recommendedSizeBtc: number;
    coverageScore: number;
    tailHitRate: number;
  };
  calibration: ConformalCalibrationPoint[];
  equation: string;
  reasons: string[];
  sources: string[];
};

export function buildConformalExecutionGuard(input: {
  decision?: OpportunityDecision;
  replay?: HistoricalReplay;
  targetCoverage?: number;
  minSamples?: number;
  maxCalibrationTrades?: number;
}): ConformalExecutionGuard {
  const targetCoverage = clamp(input.targetCoverage ?? 0.9, 0.5, 0.99);
  const minSamples = Math.max(2, input.minSamples ?? 12);
  const trades = selectCalibrationTrades(input.replay, input.maxCalibrationTrades ?? 80);
  const calibration = buildCalibrationPoints(trades);
  const sampleCount = calibration.length;
  const expectedNetUsd = input.decision?.netProfitUsd ?? 0;
  const requestedSizeBtc = input.decision?.tradeSizeBtc ?? 0;

  if (sampleCount < minSamples) {
    return {
      summary: {
        policy: "insufficient-history",
        targetCoverage,
        sampleCount,
        quantileResidualUsd: 0,
        expectedNetUsd,
        lowerBoundUsd: 0,
        recommendedSizeBtc: 0,
        coverageScore: 0,
        tailHitRate: 0,
      },
      calibration,
      equation: "lower_bound = expected_net - conformal_quantile(residuals)",
      reasons: [`need at least ${minSamples} calibration trades`, `available ${sampleCount}`],
      sources: input.replay?.sources ?? [],
    };
  }

  const residuals = calibration.map((point) => point.residualUsd);
  const quantileResidualUsd = conformalQuantile(residuals, targetCoverage);
  const lowerBoundUsd = expectedNetUsd - quantileResidualUsd;
  const tailHitRate = residuals.filter((residual) => residual >= quantileResidualUsd).length / sampleCount;
  const recommendedSizeBtc = recommendSize({
    requestedSizeBtc,
    expectedNetUsd,
    quantileResidualUsd,
    lowerBoundUsd,
  });
  const coverageScore = Math.round(
    clamp(100 - (quantileResidualUsd / Math.max(1, Math.abs(expectedNetUsd))) * 55 - tailHitRate * 20, 0, 100),
  );
  const policy: ConformalExecutionPolicy =
    !input.decision || input.decision.status !== "accepted" || expectedNetUsd <= 0
      ? "wait"
      : lowerBoundUsd > 0
        ? "execute"
        : recommendedSizeBtc > 0
          ? "cap-size"
          : "wait";

  return {
    summary: {
      policy,
      targetCoverage,
      sampleCount,
      quantileResidualUsd,
      expectedNetUsd,
      lowerBoundUsd,
      recommendedSizeBtc,
      coverageScore,
      tailHitRate,
    },
    calibration,
    equation: `lower_bound = expected_net(${round(expectedNetUsd)}) - q_${Math.round(
      targetCoverage * 100,
    )}(residuals=${round(quantileResidualUsd)}) = ${round(lowerBoundUsd)} USD`,
    reasons: buildReasons(policy, lowerBoundUsd, quantileResidualUsd, sampleCount, targetCoverage),
    sources: [
      ...(input.replay?.sources ?? []),
      "Split conformal prediction over historical simulated trade residuals",
    ],
  };
}

function selectCalibrationTrades(replay: HistoricalReplay | undefined, maxCalibrationTrades: number): HistoricalTrade[] {
  const candidates = [
    ...(replay?.trades ?? []),
    ...(replay?.validationTrades ?? []),
    ...(replay?.strategies.flatMap((strategy) => strategy.sampleTrades) ?? []),
  ];
  const unique = new Map<string, HistoricalTrade>();
  for (const trade of candidates) {
    unique.set(
      [trade.timestamp, trade.buyVenue, trade.sellVenue, trade.sizeBtc, trade.netProfitUsd.toFixed(8)].join("-"),
      trade,
    );
  }
  return [...unique.values()]
    .filter((trade) => Number.isFinite(trade.netProfitUsd) && Number.isFinite(trade.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-Math.max(1, maxCalibrationTrades));
}

function buildCalibrationPoints(trades: HistoricalTrade[]): ConformalCalibrationPoint[] {
  const allNetProfits = trades.map((trade) => trade.netProfitUsd);
  const fallbackMedian = median(allNetProfits);
  return trades.map((trade, index) => {
    const previous = allNetProfits.slice(Math.max(0, index - 8), index);
    const rollingMedianUsd = previous.length > 0 ? median(previous) : fallbackMedian;
    const residualUsd = Math.max(0, rollingMedianUsd - trade.netProfitUsd);
    return {
      timestamp: trade.timestamp,
      route: `${trade.buyVenue}->${trade.sellVenue}`,
      netProfitUsd: trade.netProfitUsd,
      rollingMedianUsd,
      residualUsd,
      spreadBps: trade.spreadBps,
    };
  });
}

function conformalQuantile(residuals: number[], targetCoverage: number): number {
  if (residuals.length === 0) return 0;
  const sorted = [...residuals].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((sorted.length + 1) * targetCoverage) - 1));
  return sorted[index] ?? 0;
}

function recommendSize(input: {
  requestedSizeBtc: number;
  expectedNetUsd: number;
  quantileResidualUsd: number;
  lowerBoundUsd: number;
}): number {
  if (input.requestedSizeBtc <= 0 || input.expectedNetUsd <= 0) return 0;
  if (input.lowerBoundUsd > 0) return input.requestedSizeBtc;
  const capitalAtRiskRatio = input.expectedNetUsd / Math.max(input.expectedNetUsd + input.quantileResidualUsd, 1e-9);
  return roundBtc(input.requestedSizeBtc * clamp(capitalAtRiskRatio, 0, 0.75));
}

function buildReasons(
  policy: ConformalExecutionPolicy,
  lowerBoundUsd: number,
  quantileResidualUsd: number,
  sampleCount: number,
  targetCoverage: number,
): string[] {
  if (policy === "execute") {
    return [
      `${Math.round(targetCoverage * 100)}% conformal lower bound remains positive`,
      `${sampleCount} historical simulated trades calibrated the residual`,
    ];
  }
  if (policy === "cap-size") {
    return [
      "nominal edge is positive but conformal lower bound is negative",
      `capital at risk capped after ${round(quantileResidualUsd)} USD calibrated residual`,
    ];
  }
  return [
    lowerBoundUsd <= 0 ? "conformal downside overwhelms the visible edge" : "no accepted live decision",
    `${sampleCount} calibration trades checked`,
  ];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): string {
  return value.toFixed(2);
}

function roundBtc(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

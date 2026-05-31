export type RecommendedFees = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
};

export type ProjectedMempoolBlock = {
  index: number;
  vsize: number;
  txCount: number;
  totalFeesSat: number;
  minFeeRate: number;
  medianFeeRate: number;
  maxFeeRate: number;
};

export type SettlementTier = {
  id: "fastest" | "half-hour" | "hour" | "economy";
  label: string;
  feeSatVb: number;
  feeUsd: number;
  estimatedBlocks: number;
  estimatedMinutes: number;
  confidence: "high" | "medium" | "low";
};

export type SettlementRiskOracle = {
  generatedAt: number;
  btcUsd: number;
  txVbytes: number;
  tiers: SettlementTier[];
  blocks: ProjectedMempoolBlock[];
  summary: {
    pressure: "clear" | "busy" | "congested" | "extreme";
    policy: "rebalance-now" | "batch-rebalance" | "internalize-only" | "halt-withdrawals";
    projectedBlocks: number;
    mempoolDepthVmb: number;
    fastestFeeUsd: number;
    economyFeeUsd: number;
    settlementPenaltyBps: number;
    strandingRiskScore: number;
  };
  explanation: string;
  sources: string[];
  errors: string[];
};

export function parseRecommendedFees(payload: unknown): RecommendedFees {
  if (isRecord(payload) && isRecord(payload.data) && isRecord(payload.data.estimates)) {
    const estimates = payload.data.estimates;
    return {
      fastestFee: nonNegativeNumber(estimates["1"]),
      halfHourFee: nonNegativeNumber(estimates["3"]),
      hourFee: nonNegativeNumber(estimates["6"]),
      economyFee: nonNegativeNumber(estimates["25"]),
      minimumFee: nonNegativeNumber(estimates["144"] || estimates["25"]),
    };
  }
  if (!isRecord(payload)) {
    return { fastestFee: 0, halfHourFee: 0, hourFee: 0, economyFee: 0, minimumFee: 0 };
  }
  return {
    fastestFee: nonNegativeNumber(payload.fastestFee),
    halfHourFee: nonNegativeNumber(payload.halfHourFee),
    hourFee: nonNegativeNumber(payload.hourFee),
    economyFee: nonNegativeNumber(payload.economyFee),
    minimumFee: nonNegativeNumber(payload.minimumFee),
  };
}

export function parseMempoolBlocks(payload: unknown): ProjectedMempoolBlock[] {
  const rows = isRecord(payload) && Array.isArray(payload.data) ? payload.data : payload;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index): ProjectedMempoolBlock | undefined => {
      if (!isRecord(row)) return undefined;
      const feeRange = Array.isArray(row.feeRange)
        ? row.feeRange.map(numberValue).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
        : [];
      const medianFee = nonNegativeNumber(row.medianFee || row.medianFeeRate || row.median_fee_rate || feeRange[Math.floor(feeRange.length / 2)]);
      const minFee = nonNegativeNumber(row.minFee || row.minFeeRate || row.min_fee_rate || feeRange[0] || medianFee);
      const maxFee = nonNegativeNumber(row.maxFee || row.maxFeeRate || row.max_fee_rate || feeRange[feeRange.length - 1] || medianFee);
      const vsize = nonNegativeNumber(row.blockVSize || row.vsize || row.size);
      return {
        index: Math.round(nonNegativeNumber(row.block_index)) || index,
        vsize: vsize || nonNegativeNumber(row.total_weight) / 4,
        txCount: nonNegativeNumber(row.nTx || row.txCount || row.tx_count),
        totalFeesSat: nonNegativeNumber(row.totalFees || row.totalFeesSat || row.total_fees_sat),
        minFeeRate: minFee,
        medianFeeRate: medianFee,
        maxFeeRate: maxFee,
      };
    })
    .filter((block): block is ProjectedMempoolBlock => Boolean(block));
}

export function buildSettlementRiskOracle(input: {
  fees: RecommendedFees;
  blocks: ProjectedMempoolBlock[];
  btcUsd: number;
  txVbytes?: number;
  generatedAt?: number;
  errors?: string[];
}): SettlementRiskOracle {
  const generatedAt = input.generatedAt ?? Date.now();
  const txVbytes = input.txVbytes ?? 180;
  const btcUsd = Number.isFinite(input.btcUsd) && input.btcUsd > 0 ? input.btcUsd : 70_000;
  const projectedBlocks = input.blocks.length;
  const mempoolDepthVmb = round(input.blocks.reduce((sum, block) => sum + block.vsize, 0) / 1_000_000, 2);
  const pressure = classifyPressure(input.fees, projectedBlocks, mempoolDepthVmb);
  const strandingRiskScore = buildStrandingRiskScore(input.fees, projectedBlocks, mempoolDepthVmb, pressure);
  const policy =
    pressure === "extreme" && input.fees.fastestFee >= 100
      ? "halt-withdrawals"
      : pressure === "extreme" || strandingRiskScore >= 70
        ? "internalize-only"
        : pressure === "congested" || strandingRiskScore >= 45
          ? "batch-rebalance"
          : "rebalance-now";
  const tiers: SettlementTier[] = [
    buildTier("fastest", "Fastest", input.fees.fastestFee, input.blocks, txVbytes, btcUsd),
    buildTier("half-hour", "Half hour", input.fees.halfHourFee, input.blocks, txVbytes, btcUsd),
    buildTier("hour", "One hour", input.fees.hourFee, input.blocks, txVbytes, btcUsd),
    buildTier("economy", "Economy", input.fees.economyFee, input.blocks, txVbytes, btcUsd),
  ];
  const fastestFeeUsd = tiers[0]?.feeUsd ?? 0;
  const economyFeeUsd = tiers[3]?.feeUsd ?? 0;
  const settlementPenaltyBps = round((fastestFeeUsd / Math.max(1, btcUsd * 0.01)) * 10_000 + strandingRiskScore * 0.08, 2);

  return {
    generatedAt,
    btcUsd,
    txVbytes,
    tiers,
    blocks: input.blocks,
    summary: {
      pressure,
      policy,
      projectedBlocks,
      mempoolDepthVmb,
      fastestFeeUsd,
      economyFeeUsd,
      settlementPenaltyBps,
      strandingRiskScore,
    },
    explanation:
      "fee_usd = fee_sat_vb * tx_vbytes * btc_usd / 100000000; eta_blocks = first projected mempool block where fee_sat_vb clears the block minimum fee; stranding risk rises with fee pressure, projected block depth, and mempool vMB.",
    sources: [
      "https://mempool.space/api/v1/fees/recommended",
      "https://mempool.space/api/v1/fees/mempool-blocks",
      "https://bitcoinsapi.com/api/v1/fees/recommended",
      "https://bitcoinsapi.com/api/v1/fees/mempool-blocks",
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    ],
    errors: input.errors ?? [],
  };
}

function buildTier(
  id: SettlementTier["id"],
  label: string,
  feeSatVb: number,
  blocks: ProjectedMempoolBlock[],
  txVbytes: number,
  btcUsd: number,
): SettlementTier {
  const estimatedBlocks = estimateBlocks(feeSatVb, blocks);
  return {
    id,
    label,
    feeSatVb,
    feeUsd: round((feeSatVb * txVbytes * btcUsd) / 100_000_000, 4),
    estimatedBlocks,
    estimatedMinutes: estimatedBlocks * 10,
    confidence: estimatedBlocks <= 2 ? "high" : estimatedBlocks <= 6 ? "medium" : "low",
  };
}

function estimateBlocks(feeSatVb: number, blocks: ProjectedMempoolBlock[]): number {
  const matchIndex = blocks.findIndex((block) => feeSatVb >= block.minFeeRate);
  if (matchIndex >= 0) return matchIndex + 1;
  return Math.max(1, blocks.length + 2);
}

function classifyPressure(
  fees: RecommendedFees,
  projectedBlocks: number,
  mempoolDepthVmb: number,
): SettlementRiskOracle["summary"]["pressure"] {
  if (fees.fastestFee >= 100 || projectedBlocks >= 8 || mempoolDepthVmb >= 8) return "extreme";
  if (fees.fastestFee >= 35 || projectedBlocks >= 5 || mempoolDepthVmb >= 5) return "congested";
  if (fees.fastestFee >= 12 || projectedBlocks >= 3 || mempoolDepthVmb >= 2.4) return "busy";
  return "clear";
}

function buildStrandingRiskScore(
  fees: RecommendedFees,
  projectedBlocks: number,
  mempoolDepthVmb: number,
  pressure: SettlementRiskOracle["summary"]["pressure"],
): number {
  const pressureBase = pressure === "extreme" ? 42 : pressure === "congested" ? 28 : pressure === "busy" ? 14 : 4;
  return clampScore(pressureBase + fees.fastestFee * 0.28 + fees.hourFee * 0.14 + projectedBlocks * 4 + mempoolDepthVmb * 2.4);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

function nonNegativeNumber(value: unknown): number {
  const parsed = numberValue(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

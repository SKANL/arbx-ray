import { describe, expect, it } from "vitest";
import { buildSettlementRiskOracle, parseMempoolBlocks, parseRecommendedFees } from "./settlement-risk";

describe("settlement risk parsers", () => {
  it("normalizes mempool.space recommended fees and projected blocks", () => {
    const fees = parseRecommendedFees({
      fastestFee: 32,
      halfHourFee: 22,
      hourFee: 14,
      economyFee: 6,
      minimumFee: 1,
    });
    const blocks = parseMempoolBlocks([
      { blockSize: 1_800_000, blockVSize: 995_000, nTx: 2200, totalFees: 18_000_000, medianFee: 24, feeRange: [18, 22, 28, 35] },
      { blockSize: 1_700_000, blockVSize: 970_000, nTx: 2100, totalFees: 12_000_000, medianFee: 13, feeRange: [8, 11, 15, 17] },
    ]);

    expect(fees.fastestFee).toBe(32);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.minFeeRate).toBe(18);
    expect(blocks[0]?.medianFeeRate).toBe(24);
    expect(blocks[1]?.vsize).toBe(970_000);
  });

  it("accepts Satoshi API fee and projected-block envelopes as a fallback source", () => {
    const fees = parseRecommendedFees({
      data: { estimates: { "1": 4.6, "3": 3, "6": 2.1, "25": 1.1, "144": 1 } },
    });
    const blocks = parseMempoolBlocks({
      data: [{ block_index: 0, total_weight: 4_000_000, tx_count: 4300, total_fees_sat: 7_000_000, min_fee_rate: 1.7, median_fee_rate: 5.8, max_fee_rate: 220 }],
    });

    expect(fees.fastestFee).toBe(4.6);
    expect(fees.economyFee).toBe(1.1);
    expect(blocks[0]?.vsize).toBe(1_000_000);
    expect(blocks[0]?.maxFeeRate).toBe(220);
  });
});

describe("buildSettlementRiskOracle", () => {
  it("recommends immediate rebalance when fees are low and next blocks are clear", () => {
    const oracle = buildSettlementRiskOracle({
      fees: parseRecommendedFees({ fastestFee: 4, halfHourFee: 3, hourFee: 2, economyFee: 1, minimumFee: 1 }),
      blocks: parseMempoolBlocks([{ blockVSize: 720_000, nTx: 900, totalFees: 1_800_000, medianFee: 2, feeRange: [1, 2, 3, 4] }]),
      btcUsd: 70_000,
      txVbytes: 180,
      generatedAt: 1_000,
    });

    expect(oracle.summary.pressure).toBe("clear");
    expect(oracle.summary.policy).toBe("rebalance-now");
    expect(oracle.summary.fastestFeeUsd).toBeCloseTo(0.504);
    expect(oracle.tiers[0]?.estimatedMinutes).toBe(10);
    expect(oracle.summary.strandingRiskScore).toBeLessThan(25);
  });

  it("halts withdrawals when projected blockspace is expensive and deep", () => {
    const oracle = buildSettlementRiskOracle({
      fees: parseRecommendedFees({ fastestFee: 145, halfHourFee: 110, hourFee: 80, economyFee: 42, minimumFee: 12 }),
      blocks: parseMempoolBlocks([
        { blockVSize: 1_000_000, nTx: 2400, totalFees: 90_000_000, medianFee: 140, feeRange: [120, 130, 145, 170] },
        { blockVSize: 1_000_000, nTx: 2300, totalFees: 70_000_000, medianFee: 95, feeRange: [75, 88, 110, 119] },
        { blockVSize: 980_000, nTx: 2100, totalFees: 45_000_000, medianFee: 52, feeRange: [34, 48, 65, 74] },
        { blockVSize: 980_000, nTx: 2000, totalFees: 32_000_000, medianFee: 30, feeRange: [18, 26, 40, 48] },
      ]),
      btcUsd: 70_000,
      txVbytes: 180,
      generatedAt: 1_000,
    });

    expect(oracle.summary.pressure).toBe("extreme");
    expect(oracle.summary.policy).toBe("halt-withdrawals");
    expect(oracle.summary.strandingRiskScore).toBeGreaterThanOrEqual(80);
    expect(oracle.tiers.find((tier) => tier.id === "economy")?.estimatedMinutes).toBeGreaterThanOrEqual(30);
  });
});

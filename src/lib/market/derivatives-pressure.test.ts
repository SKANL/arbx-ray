import { describe, expect, it } from "vitest";
import {
  buildDerivativesPressureOracle,
  parseBitmexInstrument,
  parseDeribitTicker,
  parseOkxFundingRate,
  parseOkxSwapTicker,
} from "./derivatives-pressure";

describe("derivatives pressure parsers", () => {
  it("normalizes public perpetual funding and premium sources", () => {
    const okxFunding = parseOkxFundingRate({
      data: [{ instId: "BTC-USDT-SWAP", fundingRate: "-0.00002", premium: "-0.0003", fundingTime: "1780099200000", ts: "1780080000000" }],
    }, 1000);
    const okxTicker = parseOkxSwapTicker({ data: [{ instId: "BTC-USDT-SWAP", last: "70100", volCcy24h: "1200", ts: "1780080001000" }] }, 1000);
    const deribit = parseDeribitTicker({
      result: {
        instrument_name: "BTC-PERPETUAL",
        mark_price: 70050,
        index_price: 70000,
        funding_8h: 0.00004,
        open_interest: 900_000_000,
        timestamp: 1780080002000,
      },
    }, 1000);
    const bitmex = parseBitmexInstrument([{ symbol: "XBTUSDT", markPrice: 70100, indicativeSettlePrice: 70000, fundingRate: 0.00003, openInterest: 200_000_000, timestamp: "2026-05-29T12:00:00.000Z" }], 1000);

    expect(okxFunding?.venue).toBe("okx");
    expect(okxFunding?.fundingRate8h).toBe(-0.00002);
    expect(okxFunding?.premiumBps).toBeCloseTo(-3);
    expect(okxTicker?.notionalVolumeUsd24h).toBe(1200 * 70100);
    expect(deribit?.premiumBps).toBeCloseTo(7.1428, 3);
    expect(bitmex?.premiumBps).toBeCloseTo(14.2857, 3);
  });
});

describe("buildDerivativesPressureOracle", () => {
  it("scores crowded long pressure when funding and premium are positive", () => {
    const oracle = buildDerivativesPressureOracle({
      venues: [
        venue("deribit", 0.00008, 9, 900_000_000),
        venue("bitmex", 0.00006, 7, 200_000_000),
        venue("okx", 0.00004, 3, 600_000_000),
      ],
      generatedAt: 2_000,
      staleMs: 30_000,
    });

    expect(oracle.summary.direction).toBe("long-crowded");
    expect(oracle.summary.riskState).toBe("caution");
    expect(oracle.summary.medianFundingBps8h).toBeCloseTo(0.6);
    expect(oracle.summary.spotExecutionHaircutBps).toBeGreaterThan(2);
    expect(oracle.explanation).toContain("funding_bps_8h");
  });

  it("halts execution risk when derivatives disagree violently or are stale", () => {
    const oracle = buildDerivativesPressureOracle({
      venues: [
        venue("deribit", 0.00025, 40, 900_000_000),
        venue("bitmex", -0.0002, -35, 200_000_000),
        venue("okx", 0.0003, 42, 600_000_000, -100_000),
      ],
      generatedAt: 2_000,
      staleMs: 30_000,
    });

    expect(oracle.summary.riskState).toBe("halt");
    expect(oracle.summary.staleCount).toBe(1);
    expect(oracle.summary.disagreementBps).toBeGreaterThan(70);
  });
});

function venue(venueId: string, fundingRate8h: number, premiumBps: number, openInterestUsd: number, receivedAt = 1_000) {
  return {
    venue: venueId,
    label: venueId,
    instrument: "BTC-PERP",
    fundingRate8h,
    premiumBps,
    openInterestUsd,
    receivedAt,
    source: `https://${venueId}.example`,
  };
}

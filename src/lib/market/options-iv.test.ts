import { describe, expect, it } from "vitest";
import {
  buildOptionsIvOracle,
  parseDeribitIndexPrice,
  parseDeribitOptionSummaries,
} from "./options-iv";

describe("Deribit options IV parsers", () => {
  it("normalizes BTC option summaries with expiry, strike, mark IV, and liquidity", () => {
    const quotes = parseDeribitOptionSummaries({
      result: [
        {
          instrument_name: "BTC-30MAY26-73500-C",
          mark_iv: 36.5,
          underlying_price: 73520,
          estimated_delivery_price: 73500,
          bid_price: 0.002,
          ask_price: 0.0024,
          mark_price: 0.0022,
          open_interest: 120,
          volume_usd: 50000,
        },
        { instrument_name: "ETH-30MAY26-2000-C", mark_iv: 80 },
      ],
    }, 1000);

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      instrumentName: "BTC-30MAY26-73500-C",
      optionType: "call",
      strikeUsd: 73500,
      markIvPct: 36.5,
      openInterestBtc: 120,
    });
    expect(quotes[0]?.expiryTimestamp).toBe(Date.UTC(2026, 4, 30, 8, 0, 0));
  });

  it("parses Deribit BTC index price", () => {
    expect(parseDeribitIndexPrice({ result: { index_price: 73542.88 } })).toBe(73542.88);
  });
});

describe("buildOptionsIvOracle", () => {
  it("selects liquid near-ATM options and converts IV into expected move", () => {
    const generatedAt = Date.UTC(2026, 4, 29, 12, 0, 0);
    const oracle = buildOptionsIvOracle({
      indexPriceUsd: 73500,
      quotes: [
        quote("BTC-30MAY26-73000-C", 73000, "call", 35, 200, 100_000, generatedAt + 20 * 60 * 60 * 1000),
        quote("BTC-30MAY26-74000-P", 74000, "put", 37, 180, 90_000, generatedAt + 20 * 60 * 60 * 1000),
        quote("BTC-26JUN26-100000-C", 100000, "call", 60, 500, 50_000, generatedAt + 28 * 24 * 60 * 60 * 1000),
      ],
      generatedAt,
    });

    expect(oracle.summary.selectedCount).toBe(2);
    expect(oracle.summary.atmIvPct).toBe(36);
    expect(oracle.summary.expectedMove1dBps).toBeGreaterThan(180);
    expect(oracle.summary.executionHaircutBps).toBeGreaterThan(2);
    expect(oracle.summary.regime).toBe("elevated");
    expect(oracle.explanation).toContain("expected_move_bps");
  });

  it("flags thin or extreme option surfaces as fragile", () => {
    const generatedAt = Date.UTC(2026, 4, 29, 12, 0, 0);
    const oracle = buildOptionsIvOracle({
      indexPriceUsd: 73500,
      quotes: [
        quote("BTC-30MAY26-73500-C", 73500, "call", 88, 1, 0, generatedAt + 20 * 60 * 60 * 1000),
      ],
      generatedAt,
    });

    expect(oracle.summary.regime).toBe("fragile");
    expect(oracle.summary.liquidityState).toBe("thin");
    expect(oracle.summary.executionHaircutBps).toBeGreaterThan(8);
  });
});

function quote(
  instrumentName: string,
  strikeUsd: number,
  optionType: "call" | "put",
  markIvPct: number,
  openInterestBtc: number,
  volumeUsd: number,
  expiryTimestamp: number,
) {
  return {
    instrumentName,
    optionType,
    strikeUsd,
    expiryTimestamp,
    markIvPct,
    underlyingPriceUsd: 73500,
    estimatedDeliveryPriceUsd: 73500,
    openInterestBtc,
    volumeUsd,
    receivedAt: Date.UTC(2026, 4, 29, 12, 0, 0),
    source: "https://deribit.example",
  };
}

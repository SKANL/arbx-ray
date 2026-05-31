import { describe, expect, it } from "vitest";
import {
  buildCashCarryLab,
  parseBitmexCarryPerp,
  parseDeribitCarryPerp,
  parseOkxCarryPerp,
  type CarrySpotVenue,
} from "./cash-carry";

describe("cash-carry parsers", () => {
  it("normalizes public perpetual fields needed for carry simulation", () => {
    const deribit = parseDeribitCarryPerp({
      result: {
        instrument_name: "BTC-PERPETUAL",
        mark_price: 70_420,
        index_price: 70_000,
        funding_8h: 0.00008,
        open_interest: 800_000_000,
        stats: { volume_usd: 300_000_000 },
        timestamp: 2_000,
      },
    }, 1_000);
    const okx = parseOkxCarryPerp(
      { data: [{ instId: "BTC-USDT-SWAP", fundingRate: "0.00006", ts: "2000" }] },
      { data: [{ instId: "BTC-USDT-SWAP", last: "70410", volCcy24h: "1400", ts: "2000" }] },
      1_000,
    );
    const bitmex = parseBitmexCarryPerp([{ symbol: "XBTUSDT", markPrice: 70_390, indicativeSettlePrice: 70_000, fundingRate: 0.00005, openInterest: 250_000_000, timestamp: "2026-05-29T12:00:00.000Z" }], 1_000);

    expect(deribit?.markPriceUsd).toBe(70_420);
    expect(deribit?.fundingRate8h).toBe(0.00008);
    expect(okx?.volumeUsd24h).toBeCloseTo(1400 * 70_410);
    expect(bitmex?.indexPriceUsd).toBe(70_000);
  });
});

describe("buildCashCarryLab", () => {
  it("opens a carry when perp basis and positive funding survive stress costs", () => {
    const lab = buildCashCarryLab({
      spots: [spot("coinbase", 70_000)],
      perps: [
        {
          venue: "deribit",
          label: "Deribit",
          instrument: "BTC-PERPETUAL",
          markPriceUsd: 71_120,
          fundingRate8h: 0.00012,
          takerFeeBps: 5,
          openInterestUsd: 900_000_000,
          receivedAt: 1_000,
          source: "deribit",
        },
      ],
      generatedAt: 2_000,
      holdingDays: 7,
      notionalUsd: 25_000,
      stressBasisShockBps: 60,
    });

    expect(lab.summary.recommendedAction).toBe("open-carry");
    expect(lab.summary.executableRoutes).toBe(1);
    expect(lab.routes[0]?.direction).toBe("cash-and-carry");
    expect(lab.routes[0]?.basisBps).toBeCloseTo(160);
    expect(lab.routes[0]?.expectedNetUsd).toBeGreaterThan(0);
    expect(lab.routes[0]?.formula).toContain("funding_rate_8h");
  });

  it("halts when stale data or liquidation buffer makes carry unsafe", () => {
    const lab = buildCashCarryLab({
      spots: [spot("coinbase", 70_000)],
      perps: [
        {
          venue: "bitmex",
          label: "BitMEX",
          instrument: "XBTUSDT",
          markPriceUsd: 73_500,
          fundingRate8h: 0.0002,
          takerFeeBps: 7.5,
          openInterestUsd: 100_000_000,
          receivedAt: 1_000,
          exchangeTimestamp: 1_000,
          source: "bitmex",
        },
      ],
      generatedAt: 250_000,
      staleMs: 30_000,
      stressBasisShockBps: 2_000,
    });

    expect(lab.routes[0]?.action).toBe("halt");
    expect(lab.routes[0]?.rejectionReasons).toContain("stale public market data");
    expect(lab.routes[0]?.rejectionReasons).toContain("thin liquidation buffer");
  });
});

function spot(venue: string, priceUsd: number): CarrySpotVenue {
  return {
    venue,
    label: venue,
    pair: "BTC-USD",
    priceUsd,
    takerFeeBps: 40,
    receivedAt: 1_000,
    source: venue,
  };
}

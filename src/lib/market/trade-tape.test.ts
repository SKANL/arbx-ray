import { describe, expect, it } from "vitest";
import {
  buildTradeTapeToxicity,
  parseCoinbaseTrades,
  parseKrakenTrades,
} from "./trade-tape";

describe("trade tape parsers", () => {
  it("normalizes Coinbase trades and flips maker side into aggressor side", () => {
    const trades = parseCoinbaseTrades(
      [
        {
          trade_id: 101,
          time: "2026-05-29T12:00:01.000Z",
          price: "70010.50",
          size: "0.25",
          side: "sell",
        },
        {
          trade_id: 102,
          time: "2026-05-29T12:00:02.000Z",
          price: "70000.00",
          size: "0.10",
          side: "buy",
        },
      ],
      1000,
    );

    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({
      exchangeId: "coinbase",
      symbol: "BTC-USD",
      price: 70010.5,
      sizeBtc: 0.25,
      makerSide: "sell",
      aggressorSide: "buy",
      tradeId: "101",
    });
    expect(trades[1]?.aggressorSide).toBe("sell");
    expect(trades[0]?.notionalUsd).toBeCloseTo(17502.625);
  });

  it("normalizes Kraken recent trades", () => {
    const trades = parseKrakenTrades(
      {
        error: [],
        result: {
          XXBTZUSD: [
            ["70020.1", "0.40", 1780065601.123, "b", "m", "", 12345],
            ["70000.0", "0.15", 1780065602.456, "s", "l", "", 12346],
          ],
          last: "12346",
        },
      },
      2000,
    );

    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({
      exchangeId: "kraken",
      symbol: "BTC/USD",
      price: 70020.1,
      sizeBtc: 0.4,
      aggressorSide: "buy",
      tradeId: "12345",
    });
    expect(trades[1]?.aggressorSide).toBe("sell");
    expect(trades[0]?.timestamp).toBe(1780065601123);
  });
});

describe("buildTradeTapeToxicity", () => {
  it("flags toxic sell pressure when signed flow and price drift point down together", () => {
    const base = Date.UTC(2026, 4, 29, 12, 0, 0);
    const toxicity = buildTradeTapeToxicity({
      tradesByVenue: {
        kraken: [
          tapeTrade("kraken", base + 0, 70100, 0.2, "sell"),
          tapeTrade("kraken", base + 10_000, 70040, 0.5, "sell"),
          tapeTrade("kraken", base + 20_000, 69950, 0.6, "sell"),
          tapeTrade("kraken", base + 30_000, 69940, 0.1, "buy"),
        ],
      },
      observedAt: base + 30_000,
      sources: ["kraken"],
    });

    expect(toxicity.summary.combinedScore).toBeGreaterThan(70);
    expect(toxicity.summary.recommendation).toBe("halt-fast-flow");
    expect(toxicity.venues[0]?.state).toBe("toxic");
    expect(toxicity.venues[0]?.signedVolumeBtc).toBeLessThan(0);
    expect(toxicity.venues[0]?.priceDriftBps).toBeLessThan(0);
  });

  it("keeps balanced tape benign and degrades gracefully on empty payloads", () => {
    const base = Date.UTC(2026, 4, 29, 12, 0, 0);
    const toxicity = buildTradeTapeToxicity({
      tradesByVenue: {
        coinbase: [
          tapeTrade("coinbase", base + 0, 70000, 0.2, "buy"),
          tapeTrade("coinbase", base + 20_000, 70003, 0.22, "sell"),
          tapeTrade("coinbase", base + 40_000, 70001, 0.18, "buy"),
          tapeTrade("coinbase", base + 60_000, 70002, 0.2, "sell"),
        ],
        kraken: [],
      },
      observedAt: base + 60_000,
      errors: ["kraken unavailable"],
    });

    expect(toxicity.summary.combinedScore).toBeLessThan(35);
    expect(toxicity.summary.recommendation).toBe("allow");
    expect(toxicity.venues[0]?.state).toBe("benign");
    expect(toxicity.errors).toContain("kraken unavailable");
  });
});

function tapeTrade(
  exchangeId: "coinbase" | "kraken",
  timestamp: number,
  price: number,
  sizeBtc: number,
  aggressorSide: "buy" | "sell",
) {
  return {
    exchangeId,
    symbol: exchangeId === "coinbase" ? "BTC-USD" : "BTC/USD",
    quoteAsset: "USD" as const,
    tradeId: `${exchangeId}-${timestamp}`,
    price,
    sizeBtc,
    notionalUsd: price * sizeBtc,
    timestamp,
    receivedAt: timestamp,
    aggressorSide,
    makerSide: aggressorSide === "buy" ? "sell" as const : "buy" as const,
  };
}

import { describe, expect, it } from "vitest";
import { buildTriangularLab, parseCoinbaseBook } from "./triangular";

describe("parseCoinbaseBook", () => {
  it("normalizes Coinbase level 2 book rows", () => {
    const book = parseCoinbaseBook("BTC-USD", {
      sequence: 123,
      bids: [["100", "2", 1]],
      asks: [["101", "3", 1]],
    }, 1_000);

    expect(book).toMatchObject({
      pair: "BTC-USD",
      sequence: 123,
      bids: [{ price: 100, size: 2 }],
      asks: [{ price: 101, size: 3 }],
      receivedAt: 1_000,
    });
  });
});

describe("buildTriangularLab", () => {
  it("simulates both triangular paths with L2 depth and fees", () => {
    const btcUsd = parseCoinbaseBook("BTC-USD", {
      bids: [["100000", "1"]],
      asks: [["100100", "1"]],
    });
    const ethUsd = parseCoinbaseBook("ETH-USD", {
      bids: [["2100", "10"]],
      asks: [["2000", "10"]],
    });
    const ethBtc = parseCoinbaseBook("ETH-BTC", {
      bids: [["0.0205", "10"]],
      asks: [["0.0200", "10"]],
    });

    const lab = buildTriangularLab({
      btcUsd,
      ethUsd,
      ethBtc,
      startUsd: 10_000,
      feeBps: 10,
    });

    expect(lab.routes).toHaveLength(2);
    expect(lab.bestRoute?.legs).toHaveLength(3);
    expect(lab.bestRoute?.netPnlUsd).toBeGreaterThan(0);
    expect(lab.bestRoute?.rejectionReasons).toEqual([]);
  });

  it("rejects routes when the final USD amount is below the start amount", () => {
    const btcUsd = parseCoinbaseBook("BTC-USD", {
      bids: [["100000", "1"]],
      asks: [["100100", "1"]],
    });
    const ethUsd = parseCoinbaseBook("ETH-USD", {
      bids: [["2000", "10"]],
      asks: [["2010", "10"]],
    });
    const ethBtc = parseCoinbaseBook("ETH-BTC", {
      bids: [["0.02", "10"]],
      asks: [["0.0201", "10"]],
    });

    const lab = buildTriangularLab({ btcUsd, ethUsd, ethBtc, startUsd: 10_000, feeBps: 60 });

    expect(lab.routes.every((route) => route.rejectionReasons.includes("Negative net triangular expectancy"))).toBe(true);
  });
});

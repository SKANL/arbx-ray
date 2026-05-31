import { describe, expect, it } from "vitest";
import { buildVenueLatencyRace } from "./venue-latency";

describe("buildVenueLatencyRace", () => {
  it("ranks venues by p95 latency, jitter, availability, and expected P&L haircut", () => {
    const race = buildVenueLatencyRace({
      probes: [
        probe("kraken", [80, 95, 100]),
        probe("coinbase", [140, 220, 260]),
        probe("binance", [60, 70, 600]),
      ],
      latencyBudgetMs: 500,
      notionalUsd: 50_000,
      realizedVolBpsPerSecond: 8,
      generatedAt: 1000,
    });

    expect(race.venues[0]?.venue).toBe("kraken");
    expect(race.venues[0]?.p95Ms).toBe(100);
    expect(race.venues[0]?.status).toBe("pass");
    expect(race.venues[0]?.latencyPenaltyUsd).toBeCloseTo(4);
    expect(race.venues.find((venue) => venue.venue === "binance")?.jitterMs).toBeGreaterThan(500);
    expect(race.summary.fastestVenue).toBe("kraken");
  });

  it("penalizes failed probes and reports degraded venues", () => {
    const race = buildVenueLatencyRace({
      probes: [
        {
          venue: "okx",
          label: "OKX",
          endpoint: "https://www.okx.com/api/v5/public/time",
          samples: [
            { ok: false, ms: 1500, error: "timeout" },
            { ok: true, ms: 400 },
            { ok: false, ms: 1500, error: "timeout" },
          ],
        },
      ],
      latencyBudgetMs: 900,
      notionalUsd: 100_000,
      realizedVolBpsPerSecond: 10,
      generatedAt: 1000,
    });

    expect(race.venues[0]?.availabilityPct).toBeCloseTo(33.333, 2);
    expect(race.venues[0]?.status).toBe("fail");
    expect(race.summary.degradedVenues).toBe(1);
    expect(race.errors).toContain("okx: timeout");
  });
});

function probe(venue: string, samples: number[]) {
  return {
    venue,
    label: venue,
    endpoint: `https://${venue}.example`,
    samples: samples.map((ms) => ({ ok: true, ms })),
  };
}

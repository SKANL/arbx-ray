import { describe, expect, it } from "vitest";
import {
  buildVenueReliabilityOracle,
  parseStatusPageStatus,
  type VenueStatusSnapshot,
} from "./venue-reliability";

describe("parseStatusPageStatus", () => {
  it("normalizes public Statuspage payloads into venue status snapshots", () => {
    const snapshot = parseStatusPageStatus(
      "coinbase",
      "Coinbase",
      "https://status.coinbase.com/api/v2/status.json",
      {
        status: {
          indicator: "minor",
          description: "Partially Degraded Service",
        },
        page: {
          updated_at: "2026-05-29T12:00:00Z",
        },
      },
      Date.UTC(2026, 4, 29, 12, 1, 0),
    );

    expect(snapshot).toMatchObject({
      venue: "coinbase",
      label: "Coinbase",
      indicator: "minor",
      description: "Partially Degraded Service",
      source: "https://status.coinbase.com/api/v2/status.json",
    });
    expect(snapshot?.updatedAt).toBe(Date.UTC(2026, 4, 29, 12, 0, 0));
  });
});

describe("buildVenueReliabilityOracle", () => {
  it("halts a venue with critical status, bad latency, and broken feed health", () => {
    const oracle = buildVenueReliabilityOracle({
      statuses: [
        status("coinbase", "Coinbase", "critical"),
        status("kraken", "Kraken", "none"),
      ],
      latency: {
        venues: [
          { venue: "coinbase", p95Ms: 2_100, score: 25, status: "fail" },
          { venue: "kraken", p95Ms: 180, score: 92, status: "pass" },
        ],
      },
      health: [
        { exchangeId: "coinbase", status: "error", latencyMs: 1_500 },
        { exchangeId: "kraken", status: "live", latencyMs: 120 },
      ],
      observedAt: Date.UTC(2026, 4, 29, 12, 0, 0),
    });

    expect(oracle.summary.policy).toBe("exclude-risky-venues");
    expect(oracle.summary.haltedVenues).toBe(1);
    expect(oracle.venues[0]).toMatchObject({ venue: "coinbase", policy: "halt" });
    expect(oracle.venues[0].reasons).toContain("public status critical");
    expect(oracle.venues[1]).toMatchObject({ venue: "kraken", policy: "allow" });
    expect(oracle.equation).toContain("operational_score");
  });

  it("caps venues with degraded public status but no hard outage", () => {
    const oracle = buildVenueReliabilityOracle({
      statuses: [
        status("gemini", "Gemini", "minor"),
        status("bitstamp", "Bitstamp", "maintenance"),
      ],
      observedAt: Date.UTC(2026, 4, 29, 12, 0, 0),
    });

    expect(oracle.summary.policy).toBe("cap-degraded-venues");
    expect(oracle.summary.cappedVenues).toBe(2);
    expect(oracle.venues.every((venue) => venue.policy === "cap-size")).toBe(true);
  });
});

function status(
  venue: VenueStatusSnapshot["venue"],
  label: string,
  indicator: VenueStatusSnapshot["indicator"],
): VenueStatusSnapshot {
  return {
    venue,
    label,
    indicator,
    description: indicator,
    updatedAt: Date.UTC(2026, 4, 29, 11, 59, 0),
    fetchedAt: Date.UTC(2026, 4, 29, 12, 0, 0),
    source: `https://${venue}.status.test/api/v2/status.json`,
  };
}

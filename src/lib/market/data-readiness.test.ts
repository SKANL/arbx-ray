import { describe, expect, it } from "vitest";
import { buildDataReadinessRail } from "./data-readiness";

describe("buildDataReadinessRail", () => {
  it("summarizes live, REST, replay, and route readiness", () => {
    const rail = buildDataReadinessRail({
      enabledVenues: 11,
      liveBooks: 7,
      liveFeeds: 6,
      restReady: 10,
      restTotal: 14,
      publicSources: 64,
      replayTrades: 12,
      currentRoute: true,
      routeState: "current-route",
      routeMessage: "Current executable route from the latest live books.",
    });

    expect(rail).toHaveLength(4);
    expect(rail[0]).toMatchObject({ id: "live", tone: "green", value: "7/11 books" });
    expect(rail[1]).toMatchObject({ id: "rest", tone: "amber", value: "10/14 oracles" });
    expect(rail[2]).toMatchObject({ id: "replay", tone: "green" });
    expect(rail[3]).toMatchObject({ id: "route", tone: "green", value: "current" });
  });

  it("makes missing prerequisites explicit", () => {
    const rail = buildDataReadinessRail({
      enabledVenues: 11,
      liveBooks: 0,
      liveFeeds: 0,
      restReady: 0,
      restTotal: 14,
      publicSources: 0,
      replayTrades: 0,
      currentRoute: false,
      routeState: "empty",
      routeMessage: "No route yet.",
    });

    expect(rail.map((item) => item.tone)).toEqual(["red", "red", "amber", "amber"]);
    expect(rail[0].detail).toContain("Start Live feeds");
    expect(rail[3].detail).toContain("No route yet");
  });
});

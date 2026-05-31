import { describe, expect, it } from "vitest";
import { DASHBOARD_PUBLIC_ENDPOINTS, findDashboardPublicEndpoint } from "./public-data";

describe("dashboard public data registry", () => {
  it("keeps every dashboard public endpoint key unique", () => {
    const keys = DASHBOARD_PUBLIC_ENDPOINTS.map((endpoint) => endpoint.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("documents polling cadence and no-store backend paths for critical endpoints", () => {
    expect(findDashboardPublicEndpoint("tradeTape")).toMatchObject({
      path: "/api/trade-tape",
      intervalMs: 30_000,
    });
    expect(findDashboardPublicEndpoint("historicalReplay")).toMatchObject({
      path: "/api/historical-replay",
      intervalMs: null,
    });
  });
});

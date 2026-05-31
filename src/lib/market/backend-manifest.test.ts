import { describe, expect, it } from "vitest";
import { buildBackendHealth, buildBackendManifest } from "./backend-manifest";

describe("backend manifest", () => {
  it("documents every serverless backend route as public-keyless infrastructure", () => {
    const manifest = buildBackendManifest();

    expect(manifest.architecture).toBe("nextjs-route-handlers-bff");
    expect(manifest.requiresPrivateApiKeys).toBe(false);
    expect(manifest.modules).toHaveLength(23);
    expect(manifest.modules.every((module) => module.endpoint.startsWith("/api/"))).toBe(true);
    expect(manifest.modules.every((module) => module.requiresApiKey === false)).toBe(true);
  });

  it("makes crossed public-data modules explicit for judge review", () => {
    const manifest = buildBackendManifest();
    const consensus = manifest.modules.find((module) => module.id === "price-consensus");
    const liquidity = manifest.modules.find((module) => module.id === "liquidity-radar");
    const binanceSnapshot = manifest.modules.find((module) => module.id === "binance-snapshot");
    const bitstampSnapshot = manifest.modules.find((module) => module.id === "bitstamp-snapshot");
    const kucoinToken = manifest.modules.find((module) => module.id === "kucoin-public-token");
    const liveVenueMatrix = manifest.modules.find((module) => module.id === "live-websocket-venue-matrix");

    expect(consensus?.crosses).toContain("BTC/USD");
    expect(consensus?.crosses).toContain("BTC/USDT");
    expect(consensus?.crosses).toContain("BTC/MXN via USD/MXN");
    expect(consensus?.publicSources.map((source) => source.name)).toContain("Bitso");
    expect(liquidity?.publicSources.length).toBeGreaterThanOrEqual(6);
    expect(binanceSnapshot?.fallbackPolicy).toContain("REST depth snapshot");
    expect(bitstampSnapshot?.crosses).toContain("BTC/USD L2 depth");
    expect(kucoinToken?.requiresApiKey).toBe(false);
    expect(kucoinToken?.crosses).toContain("public token");
    expect(liveVenueMatrix?.publicSources.map((source) => source.name)).toContain("Bitget");
    expect(liveVenueMatrix?.publicSources.map((source) => source.url)).toContain("wss://ws.bitget.com/v3/ws/public");
    expect(liveVenueMatrix?.fallbackPolicy).toContain("Route Handlers");
  });
});

describe("backend health", () => {
  it("summarizes serverless backend readiness without probing private services", () => {
    const health = buildBackendHealth({ generatedAt: 1_779_999_999_000 });

    expect(health.ok).toBe(true);
    expect(health.runtime).toBe("Next.js Route Handlers on Vercel-compatible serverless");
    expect(health.generatedAt).toBe(1_779_999_999_000);
    expect(health.moduleCount).toBe(23);
    expect(health.publicSourceCount).toBeGreaterThan(25);
    expect(health.checks.every((check) => check.status === "configured")).toBe(true);
    expect(health.checks.every((check) => check.requiresApiKey === false)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { buildCapitalAllocationOptimizer, type AllocationCandidate } from "./capital-allocation";

describe("buildCapitalAllocationOptimizer", () => {
  it("allocates capital toward positive risk-adjusted strategies with constraints", () => {
    const optimizer = buildCapitalAllocationOptimizer({
      bankrollUsd: 100_000,
      settlementRiskScore: 18,
      candidates: [
        candidate("live-arb", "Live Arb", 42, 18, 0.82, 40_000),
        candidate("cash-carry", "Cash Carry", 28, 10, 0.74, 50_000),
        candidate("triangular", "Triangular", -8, 25, 0.55, 25_000),
      ],
    });

    expect(optimizer.summary.policy).toBe("deploy");
    expect(optimizer.summary.allocatedUsd).toBeGreaterThan(70_000);
    expect(optimizer.allocations[0]?.id).toBe("live-arb");
    expect(optimizer.allocations.find((item) => item.id === "triangular")?.decision).toBe("skip");
    expect(optimizer.allocations.find((item) => item.id === "live-arb")?.capitalUsd).toBeLessThanOrEqual(40_000);
    expect(optimizer.equation).toContain("risk_adjusted_score");
  });

  it("moves to preserve-capital when settlement risk and CVaR are hostile", () => {
    const optimizer = buildCapitalAllocationOptimizer({
      bankrollUsd: 100_000,
      settlementRiskScore: 92,
      candidates: [
        candidate("live-arb", "Live Arb", 16, 70, 0.58, 80_000),
        candidate("mexico", "Mexico Corridor", 12, 55, 0.5, 30_000),
      ],
    });

    expect(optimizer.summary.policy).toBe("preserve-capital");
    expect(optimizer.summary.allocatedUsd).toBeLessThan(20_000);
    expect(optimizer.allocations.every((item) => item.decision !== "increase")).toBe(true);
    expect(optimizer.allocations.some((item) => item.reasons.includes("settlement risk cap"))).toBe(true);
  });
});

function candidate(
  id: AllocationCandidate["id"],
  label: string,
  expectedReturnBps: number,
  riskBps: number,
  confidence: number,
  capacityUsd: number,
): AllocationCandidate {
  return {
    id,
    label,
    expectedReturnBps,
    riskBps,
    confidence,
    capacityUsd,
    sourceCount: 3,
    status: expectedReturnBps > 0 ? "active" : "rejected",
    evidence: `${label} fixture`,
  };
}

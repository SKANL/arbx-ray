export type AllocationCandidate = {
  id: "live-arb" | "cash-carry" | "mexico" | "triangular" | "historical" | "liquidity";
  label: string;
  expectedReturnBps: number;
  riskBps: number;
  confidence: number;
  capacityUsd: number;
  sourceCount: number;
  status: "active" | "watch" | "rejected" | "missing";
  evidence: string;
};

export type CapitalAllocation = AllocationCandidate & {
  riskAdjustedScore: number;
  rawWeight: number;
  targetWeight: number;
  capitalUsd: number;
  expectedPnlUsd: number;
  cvarUsd: number;
  decision: "increase" | "cap" | "skip";
  reasons: string[];
};

export type CapitalAllocationOptimizer = {
  bankrollUsd: number;
  allocations: CapitalAllocation[];
  summary: {
    policy: "deploy" | "selective" | "preserve-capital";
    allocatedUsd: number;
    idleUsd: number;
    expectedPnlUsd: number;
    cvarUsd: number;
    portfolioReturnBps: number;
    portfolioCvarBps: number;
    activeStrategies: number;
  };
  equation: string;
};

export function buildCapitalAllocationOptimizer(input: {
  bankrollUsd?: number;
  settlementRiskScore?: number;
  candidates: AllocationCandidate[];
}): CapitalAllocationOptimizer {
  const bankrollUsd = input.bankrollUsd ?? 100_000;
  const settlementRiskScore = clampScore(input.settlementRiskScore ?? 0);
  const settlementMultiplier = settlementRiskScore >= 80 ? 0.18 : settlementRiskScore >= 55 ? 0.45 : settlementRiskScore >= 30 ? 0.7 : 1;
  const scored = input.candidates.map((candidate) => {
    const valid = candidate.status !== "missing" && candidate.status !== "rejected" && candidate.expectedReturnBps > 0 && candidate.capacityUsd > 0;
    const riskAdjustedScore = valid
      ? clampScore(
          45 +
            candidate.expectedReturnBps * 1.15 -
            candidate.riskBps * 0.55 +
            candidate.confidence * 28 +
            Math.min(10, candidate.sourceCount * 1.5),
        )
      : 0;
    const rawWeight = valid ? Math.max(0, riskAdjustedScore - 45) * Math.max(0.15, candidate.confidence) : 0;
    return { ...candidate, riskAdjustedScore, rawWeight };
  });
  const totalRawWeight = scored.reduce((sum, candidate) => sum + candidate.rawWeight, 0);
  const grossBudgetUsd = bankrollUsd * 0.9 * settlementMultiplier;

  const allocations = scored
    .map((candidate): CapitalAllocation => {
      const unconstrainedUsd = totalRawWeight > 0 ? grossBudgetUsd * (candidate.rawWeight / totalRawWeight) : 0;
      const capitalUsd = round(Math.min(candidate.capacityUsd, unconstrainedUsd));
      const expectedPnlUsd = round(capitalUsd * (candidate.expectedReturnBps / 10_000));
      const cvarUsd = round(capitalUsd * (candidate.riskBps / 10_000) * (1.15 - Math.min(0.65, candidate.confidence * 0.45)));
      const reasons = [
        ...(candidate.status === "missing" ? ["signal missing"] : []),
        ...(candidate.status === "rejected" || candidate.expectedReturnBps <= 0 ? ["negative or rejected edge"] : []),
        ...(candidate.riskBps >= 60 ? ["high CVaR load"] : []),
        ...(candidate.confidence < 0.45 ? ["low confidence"] : []),
        ...(settlementRiskScore >= 55 ? ["settlement risk cap"] : []),
        ...(capitalUsd >= candidate.capacityUsd && candidate.capacityUsd > 0 ? ["capacity cap"] : []),
      ];
      const decision =
        capitalUsd <= 0 || candidate.expectedReturnBps <= 0 || candidate.status === "rejected" || candidate.status === "missing"
          ? "skip"
          : reasons.length > 0 || candidate.riskAdjustedScore < 76
            ? "cap"
            : "increase";
      return {
        ...candidate,
        riskAdjustedScore: candidate.riskAdjustedScore,
        rawWeight: round(candidate.rawWeight, 4),
        targetWeight: bankrollUsd > 0 ? round(capitalUsd / bankrollUsd, 4) : 0,
        capitalUsd,
        expectedPnlUsd,
        cvarUsd,
        decision,
        reasons,
      };
    })
    .sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore || b.expectedPnlUsd - a.expectedPnlUsd);
  const allocatedUsd = round(allocations.reduce((sum, item) => sum + item.capitalUsd, 0));
  const expectedPnlUsd = round(allocations.reduce((sum, item) => sum + item.expectedPnlUsd, 0));
  const cvarUsd = round(allocations.reduce((sum, item) => sum + item.cvarUsd, 0));
  const blockingCaps = allocations.some(
    (item) => item.capitalUsd > 0 && item.reasons.some((reason) => reason !== "capacity cap"),
  );
  const policy =
    allocatedUsd < bankrollUsd * 0.25 || settlementRiskScore >= 80
      ? "preserve-capital"
      : allocatedUsd < bankrollUsd * 0.65 || blockingCaps
        ? "selective"
        : "deploy";

  return {
    bankrollUsd,
    allocations,
    summary: {
      policy,
      allocatedUsd,
      idleUsd: round(Math.max(0, bankrollUsd - allocatedUsd)),
      expectedPnlUsd,
      cvarUsd,
      portfolioReturnBps: bankrollUsd > 0 ? round((expectedPnlUsd / bankrollUsd) * 10_000, 2) : 0,
      portfolioCvarBps: bankrollUsd > 0 ? round((cvarUsd / bankrollUsd) * 10_000, 2) : 0,
      activeStrategies: allocations.filter((item) => item.capitalUsd > 0).length,
    },
    equation:
      "risk_adjusted_score = edge_bps*1.15 - risk_bps*0.55 + confidence*28 + source_bonus; capital = min(strategy_capacity, bankroll_budget * normalized_positive_score)",
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

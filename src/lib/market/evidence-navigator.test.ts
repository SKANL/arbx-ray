import { describe, expect, it } from "vitest";
import { buildEvidenceNavigator } from "./evidence-navigator";
import type { ChallengeEvidence } from "./challenge-evidence";

describe("buildEvidenceNavigator", () => {
  it("builds a high-impact route from demo steps and criterion coverage", () => {
    const navigator = buildEvidenceNavigator({
      evidence: evidence({
        steps: [
          step("cockpit", "cockpit", "Prove live/replay execution realism", "L2 books"),
          step("optimal-stopping-frontier", "quant", "Solve execute-now versus wait", "timing execute-now"),
          step("liquidity-topology", "market", "Map liquidity geometry", "topology route-normal"),
          step("walk-forward", "backtest", "Prove it is not overfit", "walk-forward pass"),
          step("judge", "judge", "Close with execution discipline", "governor normal"),
        ],
      }),
      maxRouteSeconds: 45,
    });

    expect(navigator.summary.totalSteps).toBe(5);
    expect(navigator.summary.totalTimeSeconds).toBe(50);
    expect(navigator.summary.highImpactTimeSeconds).toBeLessThanOrEqual(45);
    expect(navigator.highImpactRoute.map((item) => item.step.id)).toContain("optimal-stopping-frontier");
    expect(navigator.coverage.some((item) => item.criterionId === "strategy" && item.covered)).toBe(true);
    expect(navigator.byView.find((item) => item.view === "quant")?.stepCount).toBe(1);
  });

  it("surfaces weak criteria as navigation gaps", () => {
    const navigator = buildEvidenceNavigator({
      evidence: evidence({
        criteria: [
          criterion("speed", 91, "strong"),
          criterion("precision", 77, "watch"),
          criterion("robustness", 62, "gap"),
          criterion("strategy", 94, "strong"),
          criterion("architecture", 89, "strong"),
          criterion("presentation", 70, "watch"),
        ],
        steps: [step("cockpit", "cockpit", "Prove live/replay execution realism", "L2 books")],
      }),
    });

    expect(navigator.navigationGaps).toContain("Risk and failure handling");
    expect(navigator.navigationGaps).toContain("Web app presentation");
    expect(navigator.summary.coveragePct).toBeLessThan(100);
  });
});

function evidence(input: {
  criteria?: ChallengeEvidence["criteria"];
  steps?: ChallengeEvidence["demoSteps"];
}): ChallengeEvidence {
  return {
    readinessScore: 88,
    verdict: "national-final-ready",
    criteria:
      input.criteria ?? [
        criterion("speed", 91, "strong"),
        criterion("precision", 89, "strong"),
        criterion("robustness", 88, "strong"),
        criterion("strategy", 94, "strong"),
        criterion("architecture", 90, "strong"),
        criterion("presentation", 87, "watch"),
      ],
    demoSteps: input.steps ?? [],
    sourceCount: 12,
    gaps: [],
  };
}

function criterion(
  id: ChallengeEvidence["criteria"][number]["id"],
  score: number,
  status: ChallengeEvidence["criteria"][number]["status"],
): ChallengeEvidence["criteria"][number] {
  return {
    id,
    label:
      id === "speed"
        ? "Real-time detection speed"
        : id === "precision"
          ? "Net profitability precision"
          : id === "robustness"
            ? "Risk and failure handling"
            : id === "strategy"
              ? "Bot intelligence"
              : id === "architecture"
                ? "Architecture and maintainability"
                : "Web app presentation",
    score,
    status,
    proof: "fixture",
    nextMove: "fixture",
  };
}

function step(
  id: string,
  view: ChallengeEvidence["demoSteps"][number]["view"],
  label: string,
  kpi: string,
): ChallengeEvidence["demoSteps"][number] {
  return {
    id,
    view,
    label,
    kpi,
    proof: "fixture",
    timeboxSeconds: 10,
  };
}

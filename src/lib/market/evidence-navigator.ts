import type { ChallengeCriterionId, ChallengeEvidence, DashboardView, DemoStep } from "./challenge-evidence";

export type EvidenceCoverage = {
  criterionId: ChallengeCriterionId;
  label: string;
  score: number;
  status: "strong" | "watch" | "gap";
  covered: boolean;
  stepIds: string[];
};

export type EvidenceViewGroup = {
  view: DashboardView;
  stepCount: number;
  totalSeconds: number;
  strongestKpi: string;
};

export type EvidenceRouteItem = {
  step: DemoStep;
  criteria: ChallengeCriterionId[];
  impactScore: number;
};

export type EvidenceNavigator = {
  summary: {
    totalSteps: number;
    totalTimeSeconds: number;
    highImpactTimeSeconds: number;
    coveragePct: number;
    strongestView: DashboardView;
  };
  coverage: EvidenceCoverage[];
  byView: EvidenceViewGroup[];
  highImpactRoute: EvidenceRouteItem[];
  navigationGaps: string[];
};

const defaultRouteSeconds = 90;

export function buildEvidenceNavigator(input: {
  evidence: ChallengeEvidence;
  maxRouteSeconds?: number;
}): EvidenceNavigator {
  const maxRouteSeconds = Math.max(15, input.maxRouteSeconds ?? defaultRouteSeconds);
  const routeItems = input.evidence.demoSteps.map((step) => ({
    step,
    criteria: classifyStep(step),
    impactScore: scoreStep(step, classifyStep(step), input.evidence),
  }));
  const coverage = input.evidence.criteria.map((criterion) => {
    const matching = routeItems.filter((item) => item.criteria.includes(criterion.id)).map((item) => item.step.id);
    return {
      criterionId: criterion.id,
      label: criterion.label,
      score: criterion.score,
      status: criterion.status,
      covered: matching.length > 0,
      stepIds: matching,
    } satisfies EvidenceCoverage;
  });
  const byView = buildViewGroups(input.evidence.demoSteps);
  const highImpactRoute = buildHighImpactRoute(routeItems, maxRouteSeconds);
  const highImpactTimeSeconds = highImpactRoute.reduce((sum, item) => sum + item.step.timeboxSeconds, 0);
  const totalTimeSeconds = input.evidence.demoSteps.reduce((sum, step) => sum + step.timeboxSeconds, 0);
  const coveredCount = coverage.filter((item) => item.covered).length;
  const coveragePct = Math.round((coveredCount / Math.max(1, coverage.length)) * 100);
  const strongestView = byView.slice().sort((a, b) => b.stepCount - a.stepCount || b.totalSeconds - a.totalSeconds)[0]?.view ?? "judge";

  return {
    summary: {
      totalSteps: input.evidence.demoSteps.length,
      totalTimeSeconds,
      highImpactTimeSeconds,
      coveragePct,
      strongestView,
    },
    coverage,
    byView,
    highImpactRoute,
    navigationGaps: coverage
      .filter((item) => !item.covered || item.status !== "strong")
      .sort((a, b) => statusRank(a.status) - statusRank(b.status) || Number(a.covered) - Number(b.covered))
      .map((item) => item.label)
      .slice(0, 4),
  };
}

function buildViewGroups(steps: DemoStep[]): EvidenceViewGroup[] {
  const groups = new Map<DashboardView, DemoStep[]>();
  for (const step of steps) {
    groups.set(step.view, [...(groups.get(step.view) ?? []), step]);
  }
  return [...groups.entries()].map(([view, rows]) => ({
    view,
    stepCount: rows.length,
    totalSeconds: rows.reduce((sum, step) => sum + step.timeboxSeconds, 0),
    strongestKpi: rows.slice().sort((a, b) => b.kpi.length - a.kpi.length)[0]?.kpi ?? "loading",
  }));
}

function buildHighImpactRoute(items: EvidenceRouteItem[], maxRouteSeconds: number): EvidenceRouteItem[] {
  const selected: EvidenceRouteItem[] = [];
  const covered = new Set<ChallengeCriterionId>();
  const ranked = items.slice().sort((a, b) => b.impactScore - a.impactScore || a.step.timeboxSeconds - b.step.timeboxSeconds);
  const mustShow = ranked.find((item) => item.step.view === "quant" && item.criteria.includes("precision"));
  if (mustShow && mustShow.step.timeboxSeconds <= maxRouteSeconds) {
    selected.push(mustShow);
    mustShow.criteria.forEach((criterion) => covered.add(criterion));
  }
  for (const item of ranked) {
    if (selected.some((current) => current.step.id === item.step.id)) continue;
    const timeWithItem = selected.reduce((sum, current) => sum + current.step.timeboxSeconds, 0) + item.step.timeboxSeconds;
    const addsCoverage = item.criteria.some((criterion) => !covered.has(criterion));
    if (timeWithItem > maxRouteSeconds && !addsCoverage) continue;
    if (timeWithItem > maxRouteSeconds && selected.length > 0) continue;
    selected.push(item);
    item.criteria.forEach((criterion) => covered.add(criterion));
    if (covered.size >= 6 && selected.some((current) => current.step.view === "quant")) break;
  }
  return selected.sort((a, b) => viewOrder(a.step.view) - viewOrder(b.step.view) || b.impactScore - a.impactScore);
}

function classifyStep(step: DemoStep): ChallengeCriterionId[] {
  const text = `${step.id} ${step.label} ${step.kpi} ${step.proof}`.toLowerCase();
  const criteria = new Set<ChallengeCriterionId>();
  if (matches(text, ["live", "latency", "throughput", "race", "speed", "websocket"])) criteria.add("speed");
  if (matches(text, ["net", "vwap", "fees", "slippage", "conformal", "precision", "optimal", "timing"])) criteria.add("precision");
  if (matches(text, ["risk", "stress", "failure", "settlement", "governor", "halt", "mirage"])) criteria.add("robustness");
  if (matches(text, ["strategy", "graph", "topology", "triangular", "tournament", "playbook", "bayesian", "sprt", "capital", "lead-lag", "hawkes", "carry"])) criteria.add("strategy");
  if (matches(text, ["source", "public", "architecture", "worker", "audit", "fingerprint", "provenance"])) criteria.add("architecture");
  if (matches(text, ["demo", "judge", "presentation", "receipt", "close", "show"])) criteria.add("presentation");
  if (criteria.size === 0) criteria.add(step.view === "judge" ? "presentation" : "strategy");
  return [...criteria];
}

function scoreStep(step: DemoStep, criteria: ChallengeCriterionId[], evidence: ChallengeEvidence): number {
  const criterionScore = criteria.reduce((sum, criterion) => {
    const match = evidence.criteria.find((item) => item.id === criterion);
    return sum + (match?.score ?? 70);
  }, 0) / Math.max(1, criteria.length);
  const kpiBonus = /\d|execute|normal|ready|pass|ship|route|graph|topology|conformal|optimal/i.test(step.kpi) ? 10 : 0;
  const timePenalty = Math.max(0, step.timeboxSeconds - 10) * 0.7;
  return Math.round(criterionScore + criteria.length * 4 + kpiBonus - timePenalty);
}

function matches(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function viewOrder(view: DashboardView): number {
  return ["cockpit", "quant", "market", "backend", "mexico", "triangular", "backtest", "judge", "replay"].indexOf(view);
}

function statusRank(status: EvidenceCoverage["status"]): number {
  if (status === "gap") return 0;
  if (status === "watch") return 1;
  return 2;
}

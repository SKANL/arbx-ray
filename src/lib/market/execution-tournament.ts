import type { HistoricalReplay, HistoricalStrategyRun, HistoricalTrade } from "./historical";
import type { SequentialExecutionTest } from "./sequential-execution-test";
import type { WalkForwardRobustness } from "./walk-forward";

export type ExecutionTournamentPolicy =
  | "ship-autopilot"
  | "cap-and-monitor"
  | "retrain-before-demo"
  | "insufficient-history";

export type ExecutionTournamentAction = "deploy" | "cap-size" | "reject" | "retrain";

export type ExecutionTournamentContestant = {
  id:
    | "naive-spread-chaser"
    | "conservative"
    | "balanced"
    | "aggressive"
    | "walk-forward"
    | "arbx-ray-autopilot";
  label: string;
  thesis: string;
  action: ExecutionTournamentAction;
  totalPnlUsd: number;
  regretUsd: number;
  regretPct: number;
  exploitabilityScore: number;
  tradeCount: number;
  winRate: number;
  maxDrawdownUsd: number;
  robustnessScore: number;
  score: number;
  evidence: string[];
};

export type ExecutionTournament = {
  generatedAt: number;
  contestants: ExecutionTournamentContestant[];
  summary: {
    policy: ExecutionTournamentPolicy;
    championId?: ExecutionTournamentContestant["id"];
    championLabel?: string;
    arbxRank: number;
    arbxRegretUsd: number;
    bestPnlUsd: number;
    averageRegretUsd: number;
    exploitabilityScore: number;
  };
  reasons: string[];
  equation: string;
};

export function buildExecutionTournament(input?: {
  replay?: HistoricalReplay;
  walkForwardRobustness?: WalkForwardRobustness;
  sequentialExecutionTest?: SequentialExecutionTest;
  liveDecisionAvailable?: boolean;
  observedAt?: number;
}): ExecutionTournament {
  const generatedAt = input?.observedAt ?? Date.now();
  const replay = input?.replay;
  if (!replay || replay.strategies.length === 0) {
    return {
      generatedAt,
      contestants: [],
      summary: {
        policy: "insufficient-history",
        arbxRank: 0,
        arbxRegretUsd: 0,
        bestPnlUsd: 0,
        averageRegretUsd: 0,
        exploitabilityScore: 100,
      },
      reasons: ["historical replay strategies are required before running policy regret"],
      equation:
        "regret = best_counterfactual_pnl - policy_pnl; score = pnl_score + robustness_score - exploitability_penalty",
    };
  }

  const contestants = [
    naiveContestant(replay),
    ...replay.strategies.map(strategyContestant),
    walkForwardContestant(replay, input.walkForwardRobustness),
    autopilotContestant(replay, input.walkForwardRobustness, input.sequentialExecutionTest, Boolean(input.liveDecisionAvailable)),
  ];
  const bestPnlUsd = Math.max(0, ...contestants.map((contestant) => contestant.totalPnlUsd));
  const scored = contestants
    .map((contestant) => addRegret(contestant, bestPnlUsd))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.regretUsd - b.regretUsd ||
        b.totalPnlUsd - a.totalPnlUsd ||
        (a.id === "arbx-ray-autopilot" ? -1 : b.id === "arbx-ray-autopilot" ? 1 : 0),
    );
  const champion = scored[0];
  const arbxRank = scored.findIndex((contestant) => contestant.id === "arbx-ray-autopilot") + 1;
  const arbx = scored.find((contestant) => contestant.id === "arbx-ray-autopilot");
  const averageRegretUsd =
    scored.length > 0 ? scored.reduce((sum, contestant) => sum + contestant.regretUsd, 0) / scored.length : 0;
  const policy = choosePolicy({ champion, arbx, arbxRank, liveDecisionAvailable: Boolean(input.liveDecisionAvailable) });
  const reasons = reasonsFrom({ policy, champion, arbx, arbxRank, sequential: input.sequentialExecutionTest });

  return {
    generatedAt,
    contestants: scored,
    summary: {
      policy,
      championId: champion?.id,
      championLabel: champion?.label,
      arbxRank,
      arbxRegretUsd: round(arbx?.regretUsd ?? 0),
      bestPnlUsd: round(bestPnlUsd),
      averageRegretUsd: round(averageRegretUsd),
      exploitabilityScore: round(arbx?.exploitabilityScore ?? 100),
    },
    reasons,
    equation:
      "regret = best_counterfactual_pnl - policy_pnl; exploitability = regret / best_counterfactual_pnl; score = pnl_score + robustness_score + gate_bonus - exploitability_penalty",
  };
}

function naiveContestant(replay: HistoricalReplay): ExecutionTournamentContestant {
  const aggressive = replay.strategies.find((strategy) => strategy.id === "aggressive") ?? replay.strategies.at(-1);
  const summary = aggressive?.summary ?? replay.summary;
  const whipsawPenalty = Math.max(0, (summary.tradeCount - replay.summary.tradeCount) * 8 + summary.maxDrawdownUsd * 0.65);
  return {
    id: "naive-spread-chaser",
    label: "Naive spread chaser",
    thesis: "Executes every apparent historical edge with minimal caution, useful as the benchmark to beat.",
    action: "deploy",
    totalPnlUsd: round(summary.totalPnlUsd - whipsawPenalty),
    tradeCount: summary.tradeCount,
    winRate: summary.winRate,
    maxDrawdownUsd: summary.maxDrawdownUsd + whipsawPenalty * 0.35,
    robustnessScore: clampScore(45 + summary.winRate * 25 - summary.maxDrawdownUsd * 0.2 - whipsawPenalty * 0.25),
    score: clampScore((aggressive?.summary.riskAdjustedScore ?? 50) - whipsawPenalty * 0.35),
    regretUsd: 0,
    regretPct: 0,
    exploitabilityScore: 0,
    evidence: [
      "baseline competitor: fast but underprices adverse selection",
      `${summary.tradeCount} historical candidate trades`,
    ],
  };
}

function strategyContestant(strategy: HistoricalStrategyRun): ExecutionTournamentContestant {
  return {
    id: strategy.id,
    label: strategy.label,
    thesis: strategy.thesis,
    action: strategy.summary.tradeCount > 0 ? "deploy" : "reject",
    totalPnlUsd: round(strategy.summary.totalPnlUsd),
    tradeCount: strategy.summary.tradeCount,
    winRate: strategy.summary.winRate,
    maxDrawdownUsd: round(strategy.summary.maxDrawdownUsd),
    robustnessScore: robustnessFrom(strategy.summary),
    score: strategy.summary.riskAdjustedScore,
    regretUsd: 0,
    regretPct: 0,
    exploitabilityScore: 0,
    evidence: [
      `risk-adjusted score ${strategy.summary.riskAdjustedScore}/100`,
      `${strategy.summary.tradesPerHour.toFixed(2)} trades/hour, profit factor ${strategy.summary.profitFactor.toFixed(2)}`,
    ],
  };
}

function walkForwardContestant(
  replay: HistoricalReplay,
  lab: WalkForwardRobustness | undefined,
): ExecutionTournamentContestant {
  const trades = replay.validationTrades ?? [];
  const summary = summarizeTrades(trades);
  const policy = lab?.summary.policy ?? "insufficient-history";
  const policyPenalty = policy === "deploy" ? 0 : policy === "cap-size" ? 18 : policy === "reject-overfit" ? 60 : 35;
  return {
    id: "walk-forward",
    label: "Walk-forward frozen rule",
    thesis: "Selects rules in-sample, then judges them out-of-sample to expose overfit.",
    action: policy === "deploy" ? "deploy" : policy === "cap-size" ? "cap-size" : policy === "reject-overfit" ? "retrain" : "reject",
    totalPnlUsd: round(summary.totalPnlUsd),
    tradeCount: summary.tradeCount,
    winRate: summary.winRate,
    maxDrawdownUsd: round(summary.maxDrawdownUsd),
    robustnessScore: clampScore(robustnessFrom(summary) - policyPenalty * 0.25),
    score: clampScore(robustnessFrom(summary) + Math.max(0, lab?.summary.generalizationRatio ?? 0) * 30 - policyPenalty),
    regretUsd: 0,
    regretPct: 0,
    exploitabilityScore: 0,
    evidence: [
      `walk-forward ${policy}`,
      `generalization ${((lab?.summary.generalizationRatio ?? 0) * 100).toFixed(1)}%`,
      `out-of-sample P&L ${money(lab?.summary.outOfSamplePnlUsd ?? summary.totalPnlUsd)}`,
    ],
  };
}

function autopilotContestant(
  replay: HistoricalReplay,
  lab: WalkForwardRobustness | undefined,
  sequential: SequentialExecutionTest | undefined,
  liveDecisionAvailable: boolean,
): ExecutionTournamentContestant {
  const base = chooseAutopilotBase(replay, lab);
  const validationSummary = summarizeTrades(replay.validationTrades ?? []);
  const useWalkForwardRule =
    lab?.summary.policy === "deploy" &&
    validationSummary.tradeCount > 0 &&
    validationSummary.totalPnlUsd >= base.summary.totalPnlUsd;
  const baseSummary = useWalkForwardRule
    ? {
        ...validationSummary,
        riskAdjustedScore: clampScore(robustnessFrom(validationSummary) + Math.max(0, lab.summary.generalizationRatio) * 30),
      }
    : base.summary;
  const baseLabel = useWalkForwardRule ? "Walk-forward frozen rule" : base.label;
  const gate = liveDecisionAvailable ? sequential?.summary.decision : undefined;
  const gateMultiplier =
    gate === "reject-execution"
      ? 0.38
      : gate === "continue-sampling"
        ? 0.58
        : gate === "accept-cap-size"
          ? 0.72
          : 1;
  const action: ExecutionTournamentAction =
    gate === "reject-execution"
      ? "cap-size"
      : lab?.summary.policy === "reject-overfit"
        ? "retrain"
        : gate === "accept-cap-size" || lab?.summary.policy === "cap-size"
          ? "cap-size"
          : "deploy";
  const gateBonus =
    gate === "accept-execute"
      ? 10
      : gate === "accept-cap-size"
        ? 4
        : gate === "reject-execution"
          ? -18
          : liveDecisionAvailable
            ? -6
            : 4;
  const validationBonus = lab?.summary.policy === "deploy" ? 12 : lab?.summary.policy === "cap-size" ? 4 : -12;
  const baseRobustness = robustnessFrom(baseSummary);
  const totalPnlUsd = round(baseSummary.totalPnlUsd * gateMultiplier);
  const score = clampScore(baseSummary.riskAdjustedScore + validationBonus + gateBonus - baseSummary.maxDrawdownUsd * 0.05);

  return {
    id: "arbx-ray-autopilot",
    label: "ArbX-Ray autopilot",
    thesis: "Uses walk-forward evidence, live SPRT gate, and risk-aware policy selection instead of fixed spread chasing.",
    action,
    totalPnlUsd,
    tradeCount: Math.round(baseSummary.tradeCount * gateMultiplier),
    winRate: baseSummary.winRate,
    maxDrawdownUsd: round(baseSummary.maxDrawdownUsd * Math.max(0.45, gateMultiplier)),
    robustnessScore: clampScore(baseRobustness + validationBonus + gateBonus),
    score,
    regretUsd: 0,
    regretPct: 0,
    exploitabilityScore: 0,
    evidence: [
      `base policy ${baseLabel}`,
      `walk-forward ${lab?.summary.policy ?? "not loaded"}`,
      liveDecisionAvailable
        ? gate === "reject-execution"
          ? "live SPRT gate rejected current conditions, so autopilot caps size"
          : `live SPRT gate ${gate ?? "not loaded"}`
        : "historical tournament ignores missing live route and uses replay evidence",
    ],
  };
}

function chooseAutopilotBase(replay: HistoricalReplay, lab: WalkForwardRobustness | undefined): HistoricalStrategyRun {
  const strategies = [...replay.strategies].sort((a, b) => b.summary.riskAdjustedScore - a.summary.riskAdjustedScore);
  if (lab?.summary.policy === "cap-size") {
    return replay.strategies.find((strategy) => strategy.id === "conservative") ?? strategies[0]!;
  }
  if (lab?.summary.policy === "reject-overfit") {
    return replay.strategies.find((strategy) => strategy.id === "conservative") ?? strategies[0]!;
  }
  return strategies[0]!;
}

function addRegret(
  contestant: ExecutionTournamentContestant,
  bestPnlUsd: number,
): ExecutionTournamentContestant {
  const regretUsd = Math.max(0, bestPnlUsd - contestant.totalPnlUsd);
  const regretPct = bestPnlUsd > 0 ? regretUsd / bestPnlUsd : 0;
  const exploitabilityScore = clampScore(regretPct * 100);
  return {
    ...contestant,
    regretUsd: round(regretUsd),
    regretPct: round(regretPct, 4),
    exploitabilityScore,
    score: clampScore(contestant.score - exploitabilityScore * 0.22),
  };
}

function choosePolicy(input: {
  champion?: ExecutionTournamentContestant;
  arbx?: ExecutionTournamentContestant;
  arbxRank: number;
  liveDecisionAvailable: boolean;
}): ExecutionTournamentPolicy {
  if (!input.arbx) return "insufficient-history";
  if (input.arbx.action === "retrain") return "retrain-before-demo";
  if (input.arbx.action === "cap-size") return "cap-and-monitor";
  if (input.arbxRank <= 1 || input.arbx.exploitabilityScore <= 8) return "ship-autopilot";
  if (input.arbx.exploitabilityScore <= 22) return "cap-and-monitor";
  return input.liveDecisionAvailable ? "cap-and-monitor" : "retrain-before-demo";
}

function reasonsFrom(input: {
  policy: ExecutionTournamentPolicy;
  champion?: ExecutionTournamentContestant;
  arbx?: ExecutionTournamentContestant;
  arbxRank: number;
  sequential?: SequentialExecutionTest;
}): string[] {
  if (!input.arbx) return ["need historical replay before comparing policy regret"];
  return [
    `champion ${input.champion?.label ?? "unknown"} with ${money(input.champion?.totalPnlUsd ?? 0)} simulated historical P&L`,
    `ArbX-Ray rank ${input.arbxRank}, regret ${money(input.arbx.regretUsd)}, exploitability ${input.arbx.exploitabilityScore}/100`,
    input.sequential ? `live SPRT ${input.sequential.summary.decision}` : "live SPRT not loaded; ranking uses replay evidence",
    input.policy === "ship-autopilot"
      ? "autopilot wins or stays within low regret versus counterfactual policies"
      : input.policy === "cap-and-monitor"
        ? "autopilot needs capped sizing under current gate or regret conditions"
        : "historical policy needs retraining before demo deployment",
  ];
}

function summarizeTrades(trades: HistoricalTrade[]): {
  totalPnlUsd: number;
  tradeCount: number;
  winRate: number;
  maxDrawdownUsd: number;
} {
  let cumulative = 0;
  let peak = 0;
  let maxDrawdownUsd = 0;
  for (const trade of trades) {
    cumulative += trade.netProfitUsd;
    peak = Math.max(peak, cumulative);
    maxDrawdownUsd = Math.max(maxDrawdownUsd, peak - cumulative);
  }
  return {
    totalPnlUsd: trades.reduce((sum, trade) => sum + trade.netProfitUsd, 0),
    tradeCount: trades.length,
    winRate: trades.length > 0 ? trades.filter((trade) => trade.netProfitUsd > 0).length / trades.length : 0,
    maxDrawdownUsd,
  };
}

function robustnessFrom(summary: {
  totalPnlUsd: number;
  tradeCount: number;
  winRate: number;
  maxDrawdownUsd: number;
}): number {
  return clampScore(35 + summary.winRate * 32 + Math.min(24, Math.max(0, summary.totalPnlUsd) / 8) - summary.maxDrawdownUsd * 0.35);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function money(value: number): string {
  return `$${round(value).toFixed(2)}`;
}

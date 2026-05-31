import type { HistoricalReplay, HistoricalTrade } from "./historical";

export type WalkForwardPolicy = "deploy" | "cap-size" | "reject-overfit" | "insufficient-history";

export type WalkForwardCandidate = {
  minSpreadBps: number;
  trainTrades: number;
  trainPnlUsd: number;
  trainWinRate: number;
  trainScore: number;
  testTrades: number;
  testPnlUsd: number;
  testWinRate: number;
  testScore: number;
  generalizationRatio: number;
  overfitPenalty: number;
};

export type WalkForwardRobustness = {
  generatedAt: number;
  trainWindow: { start?: number; end?: number; tradeCount: number };
  testWindow: { start?: number; end?: number; tradeCount: number };
  candidates: WalkForwardCandidate[];
  selected?: WalkForwardCandidate;
  summary: {
    policy: WalkForwardPolicy;
    selectedMinSpreadBps: number;
    trainScore: number;
    testScore: number;
    generalizationRatio: number;
    outOfSamplePnlUsd: number;
    outOfSampleWinRate: number;
    overfitPenalty: number;
  };
  reasons: string[];
  equation: string;
};

const defaultThresholds = [4, 8, 12, 18, 24, 32];

export function buildWalkForwardRobustness(input?: HistoricalReplay): WalkForwardRobustness {
  const generatedAt = Date.now();
  const trades = gatherHistoricalTrades(input);
  if (trades.length < 6) {
    return {
      generatedAt,
      trainWindow: windowInfo([]),
      testWindow: windowInfo([]),
      candidates: [],
      summary: {
        policy: "insufficient-history",
        selectedMinSpreadBps: 0,
        trainScore: 0,
        testScore: 0,
        generalizationRatio: 0,
        outOfSamplePnlUsd: 0,
        outOfSampleWinRate: 0,
        overfitPenalty: 100,
      },
      reasons: ["need at least six historical simulated trades for a meaningful walk-forward split"],
      equation:
        "train_score = f(train_pnl, win_rate, activity, drawdown); selected_filter = argmax(train_score); generalization_ratio = test_score / train_score",
    };
  }

  const splitIndex = Math.max(4, Math.min(trades.length - 3, Math.floor(trades.length * 0.6)));
  const train = trades.slice(0, splitIndex);
  const test = trades.slice(splitIndex);
  const thresholds = uniqueNumbers([...defaultThresholds, ...trades.map((trade) => Math.round(trade.spreadBps))]).sort((a, b) => a - b);
  const candidates = thresholds
    .map((threshold) => candidate(threshold, train, test))
    .sort(
      (a, b) =>
        b.trainScore - a.trainScore ||
        b.testScore - a.testScore ||
        b.testPnlUsd - a.testPnlUsd ||
        b.minSpreadBps - a.minSpreadBps,
    );
  const selected = candidates[0];
  const policy = choosePolicy(selected);

  return {
    generatedAt,
    trainWindow: windowInfo(train),
    testWindow: windowInfo(test),
    candidates,
    selected,
    summary: {
      policy,
      selectedMinSpreadBps: selected?.minSpreadBps ?? 0,
      trainScore: selected?.trainScore ?? 0,
      testScore: selected?.testScore ?? 0,
      generalizationRatio: selected?.generalizationRatio ?? 0,
      outOfSamplePnlUsd: selected?.testPnlUsd ?? 0,
      outOfSampleWinRate: selected?.testWinRate ?? 0,
      overfitPenalty: selected?.overfitPenalty ?? 100,
    },
    reasons: reasons(policy, selected),
    equation:
      "train_score = f(train_pnl, win_rate, activity, drawdown); selected_filter = argmax(train_score); generalization_ratio = test_score / train_score",
  };
}

function gatherHistoricalTrades(input: HistoricalReplay | undefined): HistoricalTrade[] {
  const primary = input?.trades ?? [];
  const validation = input?.validationTrades ?? [];
  const strategySamples = input?.strategies.flatMap((strategy) => strategy.sampleTrades) ?? [];
  const byKey = new Map<string, HistoricalTrade>();
  for (const trade of [...primary, ...validation, ...strategySamples]) {
    byKey.set(`${trade.timestamp}-${trade.buyVenue}-${trade.sellVenue}-${trade.spreadBps.toFixed(4)}-${trade.netProfitUsd.toFixed(4)}`, trade);
  }
  return [...byKey.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function candidate(minSpreadBps: number, train: HistoricalTrade[], test: HistoricalTrade[]): WalkForwardCandidate {
  const trainFiltered = train.filter((trade) => trade.spreadBps >= minSpreadBps);
  const testFiltered = test.filter((trade) => trade.spreadBps >= minSpreadBps);
  const trainStats = stats(trainFiltered);
  const testStats = stats(testFiltered);
  const generalizationRatio = trainStats.score > 0 ? testStats.score / trainStats.score : 0;
  return {
    minSpreadBps,
    trainTrades: trainFiltered.length,
    trainPnlUsd: round(trainStats.pnl),
    trainWinRate: round(trainStats.winRate, 4),
    trainScore: trainStats.score,
    testTrades: testFiltered.length,
    testPnlUsd: round(testStats.pnl),
    testWinRate: round(testStats.winRate, 4),
    testScore: testStats.score,
    generalizationRatio: round(generalizationRatio, 4),
    overfitPenalty: clampScore((1 - Math.min(1, generalizationRatio)) * 100 + (testStats.pnl < 0 ? 35 : 0)),
  };
}

function stats(trades: HistoricalTrade[]): { pnl: number; winRate: number; score: number } {
  const pnl = trades.reduce((sum, trade) => sum + trade.netProfitUsd, 0);
  const winRate = trades.length > 0 ? trades.filter((trade) => trade.netProfitUsd > 0).length / trades.length : 0;
  const drawdown = maxDrawdown(trades);
  const pnlScore = Math.max(0, Math.min(45, pnl / 4));
  const winScore = winRate * 25;
  const activityScore = Math.min(20, trades.length * 3);
  const lossPenalty = trades.some((trade) => trade.netProfitUsd < 0) ? 8 : 0;
  const drawdownPenalty = Math.min(25, drawdown / 4);
  return {
    pnl,
    winRate,
    score: clampScore(pnlScore + winScore + activityScore + 10 - lossPenalty - drawdownPenalty),
  };
}

function maxDrawdown(trades: HistoricalTrade[]): number {
  let cumulative = 0;
  let peak = 0;
  let drawdown = 0;
  for (const trade of trades) {
    cumulative += trade.netProfitUsd;
    peak = Math.max(peak, cumulative);
    drawdown = Math.max(drawdown, peak - cumulative);
  }
  return drawdown;
}

function choosePolicy(selected: WalkForwardCandidate | undefined): WalkForwardPolicy {
  if (!selected) return "insufficient-history";
  if (selected.testTrades === 0 || selected.testPnlUsd <= 0 || selected.generalizationRatio < 0.35) {
    return "reject-overfit";
  }
  if (selected.generalizationRatio < 0.65 || selected.overfitPenalty > 45) return "cap-size";
  return "deploy";
}

function reasons(policy: WalkForwardPolicy, selected: WalkForwardCandidate | undefined): string[] {
  if (!selected) return ["insufficient historical evidence"];
  return [
    `trained spread filter ${selected.minSpreadBps} bps`,
    `train score ${selected.trainScore}/100 vs out-of-sample score ${selected.testScore}/100`,
    `generalization ratio ${(selected.generalizationRatio * 100).toFixed(1)}%`,
    policy === "deploy"
      ? "out-of-sample performance supports simulated deployment"
      : policy === "cap-size"
        ? "out-of-sample degradation requires capped simulated sizing"
        : "out-of-sample failure indicates overfit strategy",
  ];
}

function windowInfo(trades: HistoricalTrade[]): { start?: number; end?: number; tradeCount: number } {
  return {
    start: trades[0]?.timestamp,
    end: trades.at(-1)?.timestamp,
    tradeCount: trades.length,
  };
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value >= 0))];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

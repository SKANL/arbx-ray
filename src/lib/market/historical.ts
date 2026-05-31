export type HistoricalCandle = {
  venue: "kraken" | "coinbase";
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeBtc: number;
};

export type HistoricalTrade = {
  timestamp: number;
  buyVenue: "kraken" | "coinbase";
  sellVenue: "kraken" | "coinbase";
  buyPrice: number;
  sellPrice: number;
  sizeBtc: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  spreadBps: number;
  reason: string;
};

export type HistoricalStrategyId = "conservative" | "balanced" | "aggressive";

export type HistoricalStrategyRun = {
  id: HistoricalStrategyId;
  label: string;
  thesis: string;
  config: ReplayConfig;
  summary: HistoricalReplay["summary"] & {
    riskAdjustedScore: number;
    profitFactor: number;
    tradesPerHour: number;
  };
  equityCurve: { timestamp: number; cumulativePnlUsd: number }[];
  sampleTrades: HistoricalTrade[];
};

export type HistoricalSensitivityCell = {
  minSpreadBps: number;
  costBps: number;
  totalPnlUsd: number;
  tradeCount: number;
  winRate: number;
  riskAdjustedScore: number;
};

export type HistoricalSensitivitySurface = {
  minSpreadBpsValues: number[];
  costBpsValues: number[];
  cells: HistoricalSensitivityCell[];
  bestCell?: HistoricalSensitivityCell;
};

export type LeadLagPoint = {
  lagMinutes: number;
  correlation: number;
};

export type HistoricalStatArbSignal = {
  sampleCount: number;
  returnCorrelation: number;
  spreadMeanBps: number;
  spreadStdBps: number;
  latestSpreadBps: number;
  latestZScore: number;
  halfLifeMinutes?: number;
  leadLag: LeadLagPoint[];
  bestLeadLag: LeadLagPoint;
  regime: "mean-reverting" | "breakout-risk" | "insufficient-data";
  thesis: string;
};

export type HistoricalReplay = {
  generatedAt: number;
  candles: {
    kraken: number;
    coinbase: number;
    aligned: number;
  };
  trades: HistoricalTrade[];
  equityCurve: { timestamp: number; cumulativePnlUsd: number }[];
  summary: {
    totalPnlUsd: number;
    tradeCount: number;
    winRate: number;
    maxDrawdownUsd: number;
    averageSpreadBps: number;
    bestTradeUsd: number;
    worstTradeUsd: number;
  };
  validationTrades?: HistoricalTrade[];
  strategies: HistoricalStrategyRun[];
  sensitivity: HistoricalSensitivitySurface;
  statArb: HistoricalStatArbSignal;
  sources: string[];
  errors: string[];
};

export type ReplayConfig = {
  sizeBtc: number;
  feeBps: number;
  slippageBps: number;
  latencyBps: number;
  envelopeUncertaintyBps: number;
  minSpreadBps: number;
};

const strategyConfigs: Array<{
  id: HistoricalStrategyId;
  label: string;
  thesis: string;
  config: ReplayConfig;
}> = [
  {
    id: "conservative",
    label: "Conservative maker-grade filter",
    thesis: "Trades only larger dislocations after heavier uncertainty penalties; useful for risk-first demos.",
    config: {
      sizeBtc: 0.15,
      feeBps: 18,
      slippageBps: 5,
      latencyBps: 4,
      envelopeUncertaintyBps: 16,
      minSpreadBps: 18,
    },
  },
  {
    id: "balanced",
    label: "Balanced execution lab",
    thesis: "Default challenge profile: realistic costs, enough activity to explain decisions, and moderate risk.",
    config: {
      sizeBtc: 0.25,
      feeBps: 16,
      slippageBps: 4,
      latencyBps: 3,
      envelopeUncertaintyBps: 8,
      minSpreadBps: 8,
    },
  },
  {
    id: "aggressive",
    label: "Aggressive HFT-style scanner",
    thesis: "Accepts smaller edges with lower uncertainty; useful for showing why many apparent wins are fragile.",
    config: {
      sizeBtc: 0.35,
      feeBps: 12,
      slippageBps: 3,
      latencyBps: 2,
      envelopeUncertaintyBps: 4,
      minSpreadBps: 4,
    },
  },
];

const defaultReplayConfig: ReplayConfig = {
  sizeBtc: 0.25,
  feeBps: 16,
  slippageBps: 4,
  latencyBps: 3,
  envelopeUncertaintyBps: 8,
  minSpreadBps: 8,
};

export function parseKrakenOhlcCandles(payload: unknown): HistoricalCandle[] {
  if (!isRecord(payload) || !isRecord(payload.result)) return [];
  const series = Object.entries(payload.result).find(([key, value]) => key !== "last" && Array.isArray(value))?.[1];
  if (!Array.isArray(series)) return [];
  return series
    .map((row) => {
      if (!Array.isArray(row)) return undefined;
      return candleFromParts("kraken", row[0], row[1], row[2], row[3], row[4], row[6]);
    })
    .filter((item): item is HistoricalCandle => Boolean(item));
}

export function parseCoinbaseCandles(payload: unknown): HistoricalCandle[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((row) => {
      if (!Array.isArray(row)) return undefined;
      const [time, low, high, open, close, volume] = row;
      return candleFromParts("coinbase", time, open, high, low, close, volume);
    })
    .filter((item): item is HistoricalCandle => Boolean(item))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function buildHistoricalReplay(input: {
  kraken: HistoricalCandle[];
  coinbase: HistoricalCandle[];
  config?: Partial<ReplayConfig>;
  errors?: string[];
}): HistoricalReplay {
  const config = { ...defaultReplayConfig, ...input.config };
  const coinbaseByTime = new Map(input.coinbase.map((candle) => [bucketMinute(candle.timestamp), candle]));
  const alignedCandles = input.kraken
    .map((kraken) => ({ kraken, coinbase: coinbaseByTime.get(bucketMinute(kraken.timestamp)) }))
    .filter((pair): pair is { kraken: HistoricalCandle; coinbase: HistoricalCandle } => Boolean(pair.coinbase));
  const trades = simulateHistoricalTrades(alignedCandles, config);
  const equityCurve = buildEquityCurve(trades);
  const aligned = input.kraken.filter((candle) => coinbaseByTime.has(bucketMinute(candle.timestamp))).length;
  const strategyRuns = buildStrategyRuns(alignedCandles);
  const sensitivity = buildSensitivitySurface(alignedCandles);
  const validationTrades = buildValidationTrades(alignedCandles, sensitivity);
  const statArb = buildStatArbSignal(alignedCandles);

  return {
    generatedAt: Date.now(),
    candles: {
      kraken: input.kraken.length,
      coinbase: input.coinbase.length,
      aligned,
    },
    trades,
    equityCurve,
    summary: summarizeTrades(trades, equityCurve),
    validationTrades,
    strategies: strategyRuns,
    sensitivity,
    statArb,
    sources: [
      "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1",
      "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60",
    ],
    errors: input.errors ?? [],
  };
}

export function buildStatArbSignal(
  alignedCandles: Array<{ kraken: HistoricalCandle; coinbase: HistoricalCandle }>,
): HistoricalStatArbSignal {
  if (alignedCandles.length < 6) {
    return {
      sampleCount: alignedCandles.length,
      returnCorrelation: 0,
      spreadMeanBps: 0,
      spreadStdBps: 0,
      latestSpreadBps: 0,
      latestZScore: 0,
      leadLag: [{ lagMinutes: 0, correlation: 0 }],
      bestLeadLag: { lagMinutes: 0, correlation: 0 },
      regime: "insufficient-data",
      thesis: "Not enough aligned candles to estimate statistical arbitrage behavior.",
    };
  }

  const krakenCloses = alignedCandles.map((pair) => pair.kraken.close);
  const coinbaseCloses = alignedCandles.map((pair) => pair.coinbase.close);
  const krakenReturns = logReturns(krakenCloses);
  const coinbaseReturns = logReturns(coinbaseCloses);
  const spreads = alignedCandles.map(({ kraken, coinbase }) => {
    const mid = (kraken.close + coinbase.close) / 2;
    return mid > 0 ? ((coinbase.close - kraken.close) / mid) * 10_000 : 0;
  });
  const spreadMeanBps = mean(spreads);
  const spreadStdBps = standardDeviation(spreads);
  const latestSpreadBps = spreads[spreads.length - 1] ?? 0;
  const latestZScore = spreadStdBps > 1e-9 ? (latestSpreadBps - spreadMeanBps) / spreadStdBps : 0;
  const leadLag = [-3, -2, -1, 0, 1, 2, 3].map((lagMinutes) => ({
    lagMinutes,
    correlation: laggedCorrelation(krakenReturns, coinbaseReturns, lagMinutes),
  }));
  const bestLeadLag = leadLag.reduce((best, point) =>
    Math.abs(point.correlation) > Math.abs(best.correlation) ? point : best,
  );
  const halfLifeMinutes = estimateHalfLife(spreads);
  const returnCorrelation = correlation(krakenReturns, coinbaseReturns);
  const regime =
    Math.abs(latestZScore) >= 2 && (halfLifeMinutes === undefined || halfLifeMinutes > 30)
      ? "breakout-risk"
      : returnCorrelation > 0.75 && halfLifeMinutes !== undefined && halfLifeMinutes <= 30
        ? "mean-reverting"
        : "insufficient-data";

  return {
    sampleCount: alignedCandles.length,
    returnCorrelation,
    spreadMeanBps,
    spreadStdBps,
    latestSpreadBps,
    latestZScore,
    halfLifeMinutes,
    leadLag,
    bestLeadLag,
    regime,
    thesis:
      regime === "mean-reverting"
        ? "Spread behaves like a tightly coupled mean-reverting venue basis."
        : regime === "breakout-risk"
          ? "Spread is statistically stretched without fast estimated reversion; execution should be capped or halted."
          : "Signal is weak or mixed; use it as context rather than execution permission.",
  };
}

function buildValidationTrades(
  alignedCandles: Array<{ kraken: HistoricalCandle; coinbase: HistoricalCandle }>,
  sensitivity: HistoricalSensitivitySurface,
): HistoricalTrade[] {
  const best = sensitivity.bestCell;
  if (!best) return [];
  return simulateHistoricalTrades(alignedCandles, {
    sizeBtc: 0.25,
    feeBps: Math.max(0, best.costBps - 12),
    slippageBps: 4,
    latencyBps: 3,
    envelopeUncertaintyBps: 5,
    minSpreadBps: best.minSpreadBps,
  });
}

export function buildSensitivitySurface(
  alignedCandles: Array<{ kraken: HistoricalCandle; coinbase: HistoricalCandle }>,
): HistoricalSensitivitySurface {
  const minSpreadBpsValues = [4, 8, 12, 18, 24];
  const costBpsValues = [16, 24, 32, 44, 60];
  const cells = minSpreadBpsValues.flatMap((minSpreadBps) =>
    costBpsValues.map((costBps) => {
      const trades = simulateHistoricalTrades(alignedCandles, {
        sizeBtc: 0.25,
        feeBps: Math.max(0, costBps - 12),
        slippageBps: 4,
        latencyBps: 3,
        envelopeUncertaintyBps: 5,
        minSpreadBps,
      });
      const summary = summarizeTrades(trades, buildEquityCurve(trades));
      return {
        minSpreadBps,
        costBps,
        totalPnlUsd: summary.totalPnlUsd,
        tradeCount: summary.tradeCount,
        winRate: summary.winRate,
        riskAdjustedScore: scoreStrategy(summary),
      };
    }),
  );
  const bestCell = cells.reduce(
    (best, cell) => (cell.riskAdjustedScore > best.riskAdjustedScore ? cell : best),
    cells[0] ?? {
      minSpreadBps: 0,
      costBps: 0,
      totalPnlUsd: 0,
      tradeCount: 0,
      winRate: 0,
      riskAdjustedScore: 0,
    },
  );
  return {
    minSpreadBpsValues,
    costBpsValues,
    cells,
    bestCell,
  };
}

export function buildStrategyRuns(
  alignedCandles: Array<{ kraken: HistoricalCandle; coinbase: HistoricalCandle }>,
): HistoricalStrategyRun[] {
  const durationHours = estimateDurationHours(alignedCandles);
  return strategyConfigs.map((strategy) => {
    const trades = simulateHistoricalTrades(alignedCandles, strategy.config);
    const equityCurve = buildEquityCurve(trades);
    const summary = summarizeTrades(trades, equityCurve);
    return {
      id: strategy.id,
      label: strategy.label,
      thesis: strategy.thesis,
      config: strategy.config,
      summary: {
        ...summary,
        riskAdjustedScore: scoreStrategy(summary),
        profitFactor: profitFactor(trades),
        tradesPerHour: durationHours > 0 ? trades.length / durationHours : 0,
      },
      equityCurve,
      sampleTrades: trades.slice(-5).reverse(),
    };
  });
}

function simulateHistoricalTrades(
  alignedCandles: Array<{ kraken: HistoricalCandle; coinbase: HistoricalCandle }>,
  config: ReplayConfig,
): HistoricalTrade[] {
  const trades: HistoricalTrade[] = [];
  for (const { kraken, coinbase } of alignedCandles) {
    const candidate = selectHistoricalCandidate(kraken, coinbase, config);
    if (!candidate) continue;
    const { buyVenue, sellVenue, buyPrice, sellPrice, spreadBps, mode } = candidate;
    if (spreadBps < config.minSpreadBps) continue;

    const grossProfitUsd = (sellPrice - buyPrice) * config.sizeBtc;
    const notionalUsd = buyPrice * config.sizeBtc;
    const costBps =
      config.feeBps +
      config.slippageBps +
      config.latencyBps +
      (mode === "envelope" ? config.envelopeUncertaintyBps : 0);
    const costUsd = notionalUsd * (costBps / 10_000);
    const netProfitUsd = grossProfitUsd - costUsd;
    if (netProfitUsd <= 0) continue;
    trades.push({
      timestamp: bucketMinute(kraken.timestamp),
      buyVenue,
      sellVenue,
      buyPrice,
      sellPrice,
      sizeBtc: config.sizeBtc,
      grossProfitUsd,
      netProfitUsd,
      spreadBps,
      reason:
        mode === "close"
          ? `Historical close spread ${spreadBps.toFixed(2)} bps net of ${costBps} bps costs`
          : `Historical candle envelope ${spreadBps.toFixed(2)} bps net of ${costBps} bps costs including uncertainty`,
    });
  }
  return trades;
}

function buildEquityCurve(trades: HistoricalTrade[]): { timestamp: number; cumulativePnlUsd: number }[] {
  let cumulativePnlUsd = 0;
  return trades.map((trade) => {
    cumulativePnlUsd += trade.netProfitUsd;
    return { timestamp: trade.timestamp, cumulativePnlUsd };
  });
}

function selectHistoricalCandidate(
  kraken: HistoricalCandle,
  coinbase: HistoricalCandle,
  config: ReplayConfig,
):
  | {
      buyVenue: "kraken" | "coinbase";
      sellVenue: "kraken" | "coinbase";
      buyPrice: number;
      sellPrice: number;
      spreadBps: number;
      mode: "close" | "envelope";
    }
  | undefined {
  const closeCandidate = candidateFromPrices(
    kraken.close <= coinbase.close ? "kraken" : "coinbase",
    kraken.close <= coinbase.close ? "coinbase" : "kraken",
    Math.min(kraken.close, coinbase.close),
    Math.max(kraken.close, coinbase.close),
    "close",
  );
  if (closeCandidate && closeCandidate.spreadBps >= config.minSpreadBps) return closeCandidate;

  const krakenLowToCoinbaseHigh = candidateFromPrices(
    "kraken",
    "coinbase",
    kraken.low,
    coinbase.high,
    "envelope",
  );
  const coinbaseLowToKrakenHigh = candidateFromPrices(
    "coinbase",
    "kraken",
    coinbase.low,
    kraken.high,
    "envelope",
  );
  return [krakenLowToCoinbaseHigh, coinbaseLowToKrakenHigh]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.spreadBps - a.spreadBps)[0];
}

function scoreStrategy(summary: HistoricalReplay["summary"]): number {
  const pnlComponent = Math.min(45, Math.max(0, summary.totalPnlUsd) / 2);
  const winComponent = summary.winRate * 25;
  const tradeComponent = Math.min(20, summary.tradeCount * 4);
  const drawdownPenalty = Math.min(25, summary.maxDrawdownUsd / 2);
  return Math.round(Math.max(0, Math.min(100, pnlComponent + winComponent + tradeComponent + 10 - drawdownPenalty)));
}

function profitFactor(trades: HistoricalTrade[]): number {
  const gains = trades.filter((trade) => trade.netProfitUsd > 0).reduce((sum, trade) => sum + trade.netProfitUsd, 0);
  const losses = Math.abs(
    trades.filter((trade) => trade.netProfitUsd < 0).reduce((sum, trade) => sum + trade.netProfitUsd, 0),
  );
  if (gains <= 0) return 0;
  return losses > 0 ? gains / losses : gains;
}

function estimateDurationHours(
  alignedCandles: Array<{ kraken: HistoricalCandle; coinbase: HistoricalCandle }>,
): number {
  if (alignedCandles.length < 2) return 0;
  const first = alignedCandles[0]?.kraken.timestamp ?? 0;
  const last = alignedCandles[alignedCandles.length - 1]?.kraken.timestamp ?? first;
  return Math.max(0, (last - first) / 3_600_000);
}

function logReturns(values: number[]): number[] {
  const returns: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1] ?? 0;
    const current = values[index] ?? 0;
    if (previous > 0 && current > 0) returns.push(Math.log(current / previous));
  }
  return returns;
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function correlation(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length < 2) return 0;
  const l = left.slice(0, length);
  const r = right.slice(0, length);
  const leftMean = mean(l);
  const rightMean = mean(r);
  const numerator = l.reduce((sum, value, index) => sum + (value - leftMean) * ((r[index] ?? 0) - rightMean), 0);
  const leftDenominator = Math.sqrt(l.reduce((sum, value) => sum + (value - leftMean) ** 2, 0));
  const rightDenominator = Math.sqrt(r.reduce((sum, value) => sum + (value - rightMean) ** 2, 0));
  const denominator = leftDenominator * rightDenominator;
  return denominator > 1e-12 ? numerator / denominator : 0;
}

function laggedCorrelation(left: number[], right: number[], lag: number): number {
  if (lag === 0) return correlation(left, right);
  if (lag > 0) return correlation(left.slice(0, -lag), right.slice(lag));
  const offset = Math.abs(lag);
  return correlation(left.slice(offset), right.slice(0, -offset));
}

function estimateHalfLife(spreads: number[]): number | undefined {
  if (spreads.length < 6) return undefined;
  const deltas: number[] = [];
  const lagged: number[] = [];
  for (let index = 1; index < spreads.length; index += 1) {
    deltas.push((spreads[index] ?? 0) - (spreads[index - 1] ?? 0));
    lagged.push(spreads[index - 1] ?? 0);
  }
  const xMean = mean(lagged);
  const yMean = mean(deltas);
  const numerator = lagged.reduce((sum, value, index) => sum + (value - xMean) * ((deltas[index] ?? 0) - yMean), 0);
  const denominator = lagged.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  if (denominator <= 1e-12) return undefined;
  const beta = numerator / denominator;
  if (beta >= 0) return undefined;
  return Math.max(0, -Math.log(2) / beta);
}

function candidateFromPrices(
  buyVenue: "kraken" | "coinbase",
  sellVenue: "kraken" | "coinbase",
  buyPrice: number,
  sellPrice: number,
  mode: "close" | "envelope",
) {
  const mid = (buyPrice + sellPrice) / 2;
  if (mid <= 0 || sellPrice <= buyPrice) return undefined;
  return {
    buyVenue,
    sellVenue,
    buyPrice,
    sellPrice,
    spreadBps: ((sellPrice - buyPrice) / mid) * 10_000,
    mode,
  };
}

function summarizeTrades(
  trades: HistoricalTrade[],
  equityCurve: { timestamp: number; cumulativePnlUsd: number }[],
): HistoricalReplay["summary"] {
  const totalPnlUsd = trades.reduce((sum, trade) => sum + trade.netProfitUsd, 0);
  const winners = trades.filter((trade) => trade.netProfitUsd > 0).length;
  let peak = 0;
  let maxDrawdownUsd = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.cumulativePnlUsd);
    maxDrawdownUsd = Math.max(maxDrawdownUsd, peak - point.cumulativePnlUsd);
  }
  return {
    totalPnlUsd,
    tradeCount: trades.length,
    winRate: trades.length > 0 ? winners / trades.length : 0,
    maxDrawdownUsd,
    averageSpreadBps:
      trades.length > 0 ? trades.reduce((sum, trade) => sum + trade.spreadBps, 0) / trades.length : 0,
    bestTradeUsd: trades.length > 0 ? Math.max(...trades.map((trade) => trade.netProfitUsd)) : 0,
    worstTradeUsd: trades.length > 0 ? Math.min(...trades.map((trade) => trade.netProfitUsd)) : 0,
  };
}

function candleFromParts(
  venue: HistoricalCandle["venue"],
  timestampSeconds: unknown,
  open: unknown,
  high: unknown,
  low: unknown,
  close: unknown,
  volumeBtc: unknown,
): HistoricalCandle | undefined {
  const timestamp = Number(timestampSeconds) * 1_000;
  const parsed = {
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volumeBtc: Number(volumeBtc),
  };
  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(parsed.open) ||
    !Number.isFinite(parsed.high) ||
    !Number.isFinite(parsed.low) ||
    !Number.isFinite(parsed.close)
  ) {
    return undefined;
  }
  return { venue, timestamp, ...parsed };
}

function bucketMinute(timestamp: number): number {
  return Math.floor(timestamp / 60_000) * 60_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

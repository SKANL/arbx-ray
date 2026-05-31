import type {
  BookMicrostructure,
  EngineConfig,
  ImpactPoint,
  OrderBookLevel,
  OrderBookSnapshot,
  SimulatedFill,
} from "./types";

export function getBookMicrostructure(book: OrderBookSnapshot): BookMicrostructure {
  const bestBid = book.bids[0];
  const bestAsk = book.asks[0];
  if (!bestBid || !bestAsk) {
    return {
      midPrice: 0,
      spreadUsd: 0,
      spreadBps: 0,
      imbalance: 0,
      depthImbalance: 0,
      microprice: 0,
      micropriceDriftBps: 0,
      queuePressureBtc: 0,
      liquidityCliffRatio: 0,
      pressure: "neutral",
    };
  }

  const midPrice = (bestBid.price + bestAsk.price) / 2;
  const spreadUsd = bestAsk.price - bestBid.price;
  const topDepth = bestBid.size + bestAsk.size;
  const imbalance = topDepth > 0 ? (bestBid.size - bestAsk.size) / topDepth : 0;
  const bidDepth = sumSize(book.bids.slice(0, 5));
  const askDepth = sumSize(book.asks.slice(0, 5));
  const depthTotal = bidDepth + askDepth;
  const depthImbalance = depthTotal > 0 ? (bidDepth - askDepth) / depthTotal : 0;
  const microprice =
    topDepth > 0
      ? (bestBid.price * bestAsk.size + bestAsk.price * bestBid.size) / topDepth
      : midPrice;
  const levelSizes = [...book.bids.slice(0, 5), ...book.asks.slice(0, 5)]
    .map((level) => level.size)
    .filter((size) => size > 0);
  const maxLevelSize = Math.max(0, ...levelSizes);
  const minLevelSize = Math.min(...levelSizes);

  return {
    midPrice,
    spreadUsd,
    spreadBps: midPrice > 0 ? (spreadUsd / midPrice) * 10_000 : 0,
    imbalance,
    depthImbalance,
    microprice,
    micropriceDriftBps: midPrice > 0 ? ((microprice - midPrice) / midPrice) * 10_000 : 0,
    queuePressureBtc: bidDepth - askDepth,
    liquidityCliffRatio: minLevelSize > 0 ? maxLevelSize / minLevelSize : 0,
    pressure: depthImbalance > 0.15 ? "bid" : depthImbalance < -0.15 ? "ask" : "neutral",
  };
}

function sumSize(levels: OrderBookLevel[]): number {
  return levels.reduce((sum, level) => sum + Math.max(0, level.size), 0);
}

export function estimatePositivePnlProbability(input: {
  netProfitUsd: number;
  notionalUsd: number;
  latencyMs: number;
  realizedVolBpsPerSecond: number;
}): number {
  const latencySeconds = Math.max(0.001, input.latencyMs / 1_000);
  const sigmaUsd =
    input.notionalUsd *
    (Math.max(0, input.realizedVolBpsPerSecond) / 10_000) *
    Math.sqrt(latencySeconds);

  if (sigmaUsd <= 1e-9) return input.netProfitUsd > 0 ? 1 : 0;
  return clamp(normalCdf(input.netProfitUsd / sigmaUsd), 0.001, 0.999);
}

export function estimateRealizedVolBpsPerSecond(closes: number[], intervalSeconds: number): number {
  const returns: number[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    const previous = closes[index - 1];
    const current = closes[index];
    if (!previous || !current || previous <= 0 || current <= 0) continue;
    returns.push(Math.log(current / previous));
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return (Math.sqrt(variance) * 10_000) / Math.sqrt(intervalSeconds);
}

export function buildImpactCurve(
  buyBook: OrderBookSnapshot,
  sellBook: OrderBookSnapshot,
  config: EngineConfig,
  sizesBtc: number[],
  observedAt = Date.now(),
): ImpactPoint[] {
  return sizesBtc.map((sizeBtc) => {
    const buyFill = simulateMarketFill(buyBook.asks, sizeBtc);
    const sellFill = simulateMarketFill(sellBook.bids, sizeBtc);
    const tradeSizeBtc = Math.min(buyFill.filledBtc, sellFill.filledBtc);
    const adjustedBuyFill =
      tradeSizeBtc === buyFill.filledBtc ? buyFill : simulateMarketFill(buyBook.asks, tradeSizeBtc);
    const adjustedSellFill =
      tradeSizeBtc === sellFill.filledBtc
        ? sellFill
        : simulateMarketFill(sellBook.bids, tradeSizeBtc);
    const buyFeeUsd = adjustedBuyFill.notional * ((config.feesBps[buyBook.exchangeId] ?? 20) / 10_000);
    const sellFeeUsd =
      adjustedSellFill.notional * ((config.feesBps[sellBook.exchangeId] ?? 20) / 10_000);
    const ageMs = Math.max(0, observedAt - buyBook.receivedAt, observedAt - sellBook.receivedAt);
    const latencyPenaltyUsd =
      adjustedSellFill.notional *
      (config.latencyVolatilityBpsPerSecond / 10_000) *
      (ageMs / 1_000);
    const referencePrice =
      adjustedBuyFill.vwap || buyBook.asks[0]?.price || sellBook.bids[0]?.price || 0;
    const grossProfitUsd = adjustedSellFill.notional - adjustedBuyFill.notional;
    const netProfitUsd =
      grossProfitUsd -
      buyFeeUsd -
      sellFeeUsd -
      config.withdrawalFeeBtc * referencePrice -
      latencyPenaltyUsd;
    return {
      sizeBtc,
      grossProfitUsd,
      netProfitUsd,
      buyVwap: adjustedBuyFill.vwap,
      sellVwap: adjustedSellFill.vwap,
      accepted: netProfitUsd > config.minNetProfitUsd,
    };
  });
}

function normalCdf(value: number): number {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function erf(value: number): number {
  const sign = value >= 0 ? 1 : -1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return sign * y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function simulateMarketFill(levels: OrderBookLevel[], targetBtc: number): SimulatedFill {
  let remaining = Math.max(0, targetBtc);
  let filledBtc = 0;
  let notional = 0;
  const levelsUsed = [];
  for (const level of levels) {
    if (remaining <= 0) break;
    if (level.price <= 0 || level.size <= 0) continue;
    const filledAtLevel = Math.min(remaining, level.size);
    const levelNotional = filledAtLevel * level.price;
    filledBtc += filledAtLevel;
    notional += levelNotional;
    remaining -= filledAtLevel;
    levelsUsed.push({
      price: level.price,
      requestedBtc: remaining + filledAtLevel,
      filledBtc: filledAtLevel,
      notional: levelNotional,
    });
  }
  return {
    filledBtc,
    notional,
    vwap: filledBtc > 0 ? notional / filledBtc : 0,
    complete: remaining <= 1e-12,
    levelsUsed,
  };
}

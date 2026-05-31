import type { OpportunityDecision, SimulatedFill } from "./types";

export type DepthLensLevel = {
  index: number;
  price: number;
  filledBtc: number;
  cumulativeBtc: number;
  cumulativeNotionalUsd: number;
  cumulativeVwap: number;
  slippageBps: number;
};

export type DepthLensSide = {
  side: "buy" | "sell";
  exchange: string;
  complete: boolean;
  levelsUsed: number;
  filledBtc: number;
  vwap: number;
  topPrice: number;
  slippageBps: number;
  levels: DepthLensLevel[];
};

export type ExecutionDepthLens = {
  buy: DepthLensSide;
  sell: DepthLensSide;
  netVwapEdgeBps: number;
};

export function buildExecutionDepthLens(decision: OpportunityDecision): ExecutionDepthLens {
  const buy = buildSide("buy", decision.buyExchange, decision.buyFill);
  const sell = buildSide("sell", decision.sellExchange, decision.sellFill);
  const midVwap = (buy.vwap + sell.vwap) / 2;
  return {
    buy,
    sell,
    netVwapEdgeBps: midVwap > 0 ? ((sell.vwap - buy.vwap) / midVwap) * 10_000 : 0,
  };
}

function buildSide(
  side: "buy" | "sell",
  exchange: string,
  fill: SimulatedFill,
): DepthLensSide {
  const topPrice = fill.levelsUsed[0]?.price ?? fill.vwap;
  let cumulativeBtc = 0;
  let cumulativeNotionalUsd = 0;
  const levels = fill.levelsUsed.map((level, index) => {
    cumulativeBtc += level.filledBtc;
    cumulativeNotionalUsd += level.notional;
    const cumulativeVwap = cumulativeBtc > 0 ? cumulativeNotionalUsd / cumulativeBtc : 0;
    return {
      index: index + 1,
      price: level.price,
      filledBtc: level.filledBtc,
      cumulativeBtc,
      cumulativeNotionalUsd,
      cumulativeVwap,
      slippageBps: slippageFromTop(side, topPrice, cumulativeVwap),
    };
  });

  return {
    side,
    exchange,
    complete: fill.complete,
    levelsUsed: fill.levelsUsed.length,
    filledBtc: fill.filledBtc,
    vwap: fill.vwap,
    topPrice,
    slippageBps: slippageFromTop(side, topPrice, fill.vwap),
    levels,
  };
}

function slippageFromTop(side: "buy" | "sell", topPrice: number, vwap: number): number {
  if (topPrice <= 0 || vwap <= 0) return 0;
  const signed = side === "buy" ? vwap - topPrice : topPrice - vwap;
  return (signed / topPrice) * 10_000;
}

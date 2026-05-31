import { defaultEngineConfig } from "./defaults";
import type { TradeTapeToxicity, TradeTapeVenueSummary } from "./trade-tape";
import type { OpportunityDecision, OrderBookSnapshot } from "./types";

export type QueueLegEstimate = {
  side: "buy" | "sell";
  exchangeId: string;
  makerPrice: number;
  takerPrice: number;
  queueAheadBtc: number;
  aggressorFlowBtcPerSecond: number;
  fillProbability: number;
  expectedFillBtc: number;
  makerFeeUsd: number;
  takerFeeUsd: number;
  spreadCaptureUsd: number;
  feeSavingsUsd: number;
  adverseSelectionUsd: number;
  expectedValueUsd: number;
  recommendation: "post-maker" | "cross-taker";
  reasons: string[];
};

export type QueuePositionOracle = {
  generatedAt: number;
  horizonMs: number;
  buyLeg: QueueLegEstimate;
  sellLeg: QueueLegEstimate;
  summary: {
    recommendation: "post-both-legs" | "post-buy-only" | "post-sell-only" | "cross-now";
    takerNetUsd: number;
    expectedMakerNetUsd: number;
    expectedImprovementUsd: number;
    combinedFillProbability: number;
    toxicFlowPenaltyUsd: number;
  };
  equation: string;
};

export function buildQueuePositionOracle(input: {
  decision?: OpportunityDecision;
  books: OrderBookSnapshot[];
  tape?: TradeTapeToxicity;
  horizonMs?: number;
  observedAt?: number;
}): QueuePositionOracle {
  const generatedAt = input.observedAt ?? Date.now();
  const horizonMs = input.horizonMs ?? 10_000;
  const decision = input.decision;
  if (!decision) {
    const emptyLeg = emptyLegEstimate("buy");
    return {
      generatedAt,
      horizonMs,
      buyLeg: emptyLeg,
      sellLeg: emptyLegEstimate("sell"),
      summary: {
        recommendation: "cross-now",
        takerNetUsd: 0,
        expectedMakerNetUsd: 0,
        expectedImprovementUsd: 0,
        combinedFillProbability: 0,
        toxicFlowPenaltyUsd: 0,
      },
      equation:
        "fill_probability = 1 - exp(-(aggressor_flow_btc_per_sec * horizon_sec) / (queue_ahead_btc + order_size_btc)); maker_ev = fill_probability*(spread_capture + fee_savings) - adverse_selection - (1-fill_probability)*missed_edge",
    };
  }
  const buyBook = input.books.find((book) => book.exchangeId === decision.buyExchange);
  const sellBook = input.books.find((book) => book.exchangeId === decision.sellExchange);
  const buyVenueTape = input.tape?.venues.find((venue) => venue.exchangeId === decision.buyExchange);
  const sellVenueTape = input.tape?.venues.find((venue) => venue.exchangeId === decision.sellExchange);
  const buyLeg = estimateLeg({
    side: "buy",
    exchangeId: decision.buyExchange,
    book: buyBook,
    tape: buyVenueTape,
    takerPrice: decision.buyFill.vwap,
    tradeSizeBtc: decision.tradeSizeBtc,
    takerNetUsd: decision.netProfitUsd,
    horizonMs,
  });
  const sellLeg = estimateLeg({
    side: "sell",
    exchangeId: decision.sellExchange,
    book: sellBook,
    tape: sellVenueTape,
    takerPrice: decision.sellFill.vwap,
    tradeSizeBtc: decision.tradeSizeBtc,
    takerNetUsd: decision.netProfitUsd,
    horizonMs,
  });
  const postBuy = buyLeg.recommendation === "post-maker";
  const postSell = sellLeg.recommendation === "post-maker";
  const toxicFlowPenaltyUsd = round(buyLeg.adverseSelectionUsd + sellLeg.adverseSelectionUsd);
  const expectedImprovementUsd = round(buyLeg.expectedValueUsd + sellLeg.expectedValueUsd);
  const expectedMakerNetUsd = round(decision.netProfitUsd + expectedImprovementUsd);
  const recommendation =
    postBuy && postSell
      ? "post-both-legs"
      : postBuy
        ? "post-buy-only"
        : postSell
          ? "post-sell-only"
          : "cross-now";

  return {
    generatedAt,
    horizonMs,
    buyLeg,
    sellLeg,
    summary: {
      recommendation,
      takerNetUsd: round(decision.netProfitUsd),
      expectedMakerNetUsd,
      expectedImprovementUsd,
      combinedFillProbability: round(buyLeg.fillProbability * sellLeg.fillProbability, 4),
      toxicFlowPenaltyUsd,
    },
    equation:
      "fill_probability = 1 - exp(-(aggressor_flow_btc_per_sec * horizon_sec) / (queue_ahead_btc + order_size_btc)); maker_ev = fill_probability*(spread_capture + fee_savings) - adverse_selection - (1-fill_probability)*missed_edge",
  };
}

function estimateLeg(input: {
  side: "buy" | "sell";
  exchangeId: string;
  book?: OrderBookSnapshot;
  tape?: TradeTapeVenueSummary;
  takerPrice: number;
  tradeSizeBtc: number;
  takerNetUsd: number;
  horizonMs: number;
}): QueueLegEstimate {
  const levels = input.side === "buy" ? input.book?.bids : input.book?.asks;
  const makerPrice = levels?.[0]?.price ?? input.takerPrice;
  const queueAheadBtc = levels?.[0]?.size ?? input.tradeSizeBtc;
  const horizonSec = input.horizonMs / 1_000;
  const aggressorFlowBtcPerSecond = flowForFill(input.side, input.tape);
  const fillProbability = clamp(
    1 - Math.exp(-(aggressorFlowBtcPerSecond * horizonSec) / Math.max(0.000001, queueAheadBtc + input.tradeSizeBtc)),
    0,
    0.98,
  );
  const expectedFillBtc = input.tradeSizeBtc * fillProbability;
  const takerFeeBps = defaultEngineConfig.feesBps[input.exchangeId] ?? 25;
  const makerFeeBps = Math.max(0, takerFeeBps - 15);
  const notional = input.tradeSizeBtc * input.takerPrice;
  const takerFeeUsd = notional * (takerFeeBps / 10_000);
  const makerFeeUsd = input.tradeSizeBtc * makerPrice * (makerFeeBps / 10_000);
  const spreadCaptureUsd =
    input.side === "buy"
      ? Math.max(0, input.takerPrice - makerPrice) * input.tradeSizeBtc
      : Math.max(0, makerPrice - input.takerPrice) * input.tradeSizeBtc;
  const feeSavingsUsd = Math.max(0, takerFeeUsd - makerFeeUsd);
  const adverseSelectionUsd = estimateAdverseSelection(input.side, input.tape, input.tradeSizeBtc, input.takerPrice, input.horizonMs);
  const missedEdgeUsd = Math.max(0, input.takerNetUsd) * 0.45;
  const expectedValueUsd =
    fillProbability * (spreadCaptureUsd + feeSavingsUsd) -
    adverseSelectionUsd -
    (1 - fillProbability) * missedEdgeUsd;
  const reasons = [
    ...(fillProbability < 0.55 ? ["low queue fill probability"] : []),
    ...(adverseSelectionUsd > Math.max(1, spreadCaptureUsd + feeSavingsUsd) ? ["adverse selection dominates maker savings"] : []),
    ...(input.tape?.state === "toxic" ? ["toxic public trade tape"] : []),
    ...(queueAheadBtc > input.tradeSizeBtc * 12 ? ["large queue ahead"] : []),
  ];
  const recommendation = expectedValueUsd > 0 && fillProbability >= 0.55 && input.tape?.state !== "toxic" ? "post-maker" : "cross-taker";

  return {
    side: input.side,
    exchangeId: input.exchangeId,
    makerPrice,
    takerPrice: input.takerPrice,
    queueAheadBtc,
    aggressorFlowBtcPerSecond,
    fillProbability: round(fillProbability, 4),
    expectedFillBtc: round(expectedFillBtc, 8),
    makerFeeUsd: round(makerFeeUsd),
    takerFeeUsd: round(takerFeeUsd),
    spreadCaptureUsd: round(spreadCaptureUsd),
    feeSavingsUsd: round(feeSavingsUsd),
    adverseSelectionUsd: round(adverseSelectionUsd),
    expectedValueUsd: round(expectedValueUsd),
    recommendation,
    reasons: reasons.length ? reasons : ["queue economics support maker posting"],
  };
}

function flowForFill(side: "buy" | "sell", tape?: TradeTapeVenueSummary): number {
  if (!tape) return 0;
  const windowMinutes = tape.tradeCount / Math.max(0.1, tape.tradesPerMinute);
  const windowSeconds = Math.max(1, windowMinutes * 60);
  return side === "buy" ? tape.sellAggressorBtc / windowSeconds : tape.buyAggressorBtc / windowSeconds;
}

function estimateAdverseSelection(
  side: "buy" | "sell",
  tape: TradeTapeVenueSummary | undefined,
  sizeBtc: number,
  referencePrice: number,
  horizonMs: number,
): number {
  if (!tape) return referencePrice * sizeBtc * 0.00008;
  const toxicPenaltyBps = tape.toxicityScore * 0.045;
  const driftAgainstMakerBps =
    side === "buy" ? Math.max(0, tape.priceDriftBps) : Math.max(0, -tape.priceDriftBps);
  const horizonScale = Math.max(0.25, horizonMs / 10_000);
  return referencePrice * sizeBtc * ((toxicPenaltyBps + driftAgainstMakerBps) / 10_000) * horizonScale;
}

function emptyLegEstimate(side: "buy" | "sell"): QueueLegEstimate {
  return {
    side,
    exchangeId: "none",
    makerPrice: 0,
    takerPrice: 0,
    queueAheadBtc: 0,
    aggressorFlowBtcPerSecond: 0,
    fillProbability: 0,
    expectedFillBtc: 0,
    makerFeeUsd: 0,
    takerFeeUsd: 0,
    spreadCaptureUsd: 0,
    feeSavingsUsd: 0,
    adverseSelectionUsd: 0,
    expectedValueUsd: 0,
    recommendation: "cross-taker",
    reasons: ["waiting for accepted route"],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

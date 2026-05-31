import type {
  EngineConfig,
  OpportunityDecision,
  OrderBookLevel,
  OrderBookSnapshot,
  SimulatedFill,
  TradeEvent,
  WalletBalance,
  WalletState,
} from "./types";
import {
  estimatePositivePnlProbability,
  getBookMicrostructure,
} from "./quant";

const emptyWallet: WalletBalance = { BTC: 0, USD: 0, USDT: 0 };

export function simulateMarketFill(
  levels: OrderBookLevel[],
  targetBtc: number,
): SimulatedFill {
  let remaining = Math.max(0, targetBtc);
  let filledBtc = 0;
  let notional = 0;
  const levelsUsed = [];

  for (const level of levels) {
    if (remaining <= 0) break;
    if (!Number.isFinite(level.price) || !Number.isFinite(level.size)) continue;
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

export function evaluateOpportunity(
  buyBook: OrderBookSnapshot,
  sellBook: OrderBookSnapshot,
  wallets: WalletState,
  config: EngineConfig,
  observedAt = Date.now(),
): OpportunityDecision {
  const rejectionReasons: string[] = [];
  const reasons: string[] = [];

  const buyAge = observedAt - buyBook.receivedAt;
  const sellAge = observedAt - sellBook.receivedAt;
  if (buyAge > config.staleBookMs) rejectionReasons.push("Stale buy book");
  if (sellAge > config.staleBookMs) rejectionReasons.push("Stale sell book");
  if (buyAge > config.maxLatencyMs || sellAge > config.maxLatencyMs) {
    rejectionReasons.push("Excessive latency");
  }

  if (buyBook.quoteAsset !== sellBook.quoteAsset) {
    rejectionReasons.push("Cross-lane comparison requires basis haircut");
    reasons.push(`Cross quote lane: ${buyBook.quoteAsset}/${sellBook.quoteAsset}`);
  } else {
    reasons.push(`Same quote lane: ${buyBook.quoteAsset}`);
  }

  const buyWallet = wallets[buyBook.exchangeId] ?? emptyWallet;
  const sellWallet = wallets[sellBook.exchangeId] ?? emptyWallet;
  const bestAsk = buyBook.asks[0]?.price ?? 0;
  const bestBid = sellBook.bids[0]?.price ?? 0;

  if (bestAsk <= 0 || bestBid <= 0 || bestAsk >= bestBid) {
    rejectionReasons.push("No positive gross spread");
  }

  const quoteAvailable = buyWallet[buyBook.quoteAsset] ?? 0;
  const maxByQuote = bestAsk > 0 ? quoteAvailable / bestAsk : 0;
  const maxByInventory = sellWallet.BTC;
  const desiredSize = Math.min(config.maxTradeBtc, maxByQuote, maxByInventory);

  if (maxByQuote <= 0) rejectionReasons.push(`Insufficient ${buyBook.quoteAsset} on buy venue`);
  if (maxByInventory <= 0) rejectionReasons.push("Insufficient BTC on sell venue");

  const buyFill = simulateMarketFill(buyBook.asks, desiredSize);
  const sellFill = simulateMarketFill(sellBook.bids, desiredSize);
  const tradeSizeBtc = Math.min(buyFill.filledBtc, sellFill.filledBtc);

  if (tradeSizeBtc <= 0) rejectionReasons.push("Insufficient liquidity");
  if (!buyFill.complete || !sellFill.complete) rejectionReasons.push("Partial fill due to shallow book");

  const adjustedBuyFill =
    tradeSizeBtc === buyFill.filledBtc ? buyFill : simulateMarketFill(buyBook.asks, tradeSizeBtc);
  const adjustedSellFill =
    tradeSizeBtc === sellFill.filledBtc ? sellFill : simulateMarketFill(sellBook.bids, tradeSizeBtc);

  const buyFeeUsd = adjustedBuyFill.notional * feeRate(buyBook.exchangeId, config);
  const sellFeeUsd = adjustedSellFill.notional * feeRate(sellBook.exchangeId, config);
  const feeCostUsd = buyFeeUsd + sellFeeUsd;
  const grossProfitUsd = adjustedSellFill.notional - adjustedBuyFill.notional;
  const referencePrice = adjustedBuyFill.vwap || bestAsk || bestBid;
  const withdrawalCostUsd = config.withdrawalFeeBtc * referencePrice;
  const latencyMs = Math.max(0, buyAge, sellAge);
  const latencyPenaltyUsd =
    adjustedSellFill.notional *
    (config.latencyVolatilityBpsPerSecond / 10_000) *
    (latencyMs / 1_000);
  const basisHaircutUsd =
    buyBook.quoteAsset === sellBook.quoteAsset
      ? 0
      : adjustedSellFill.notional * (config.usdtUsdHaircutBps / 10_000);
  const netProfitUsd =
    grossProfitUsd - feeCostUsd - withdrawalCostUsd - latencyPenaltyUsd - basisHaircutUsd;
  const notionalUsd = Math.max(adjustedBuyFill.notional, adjustedSellFill.notional);
  const positivePnlProbability = estimatePositivePnlProbability({
    netProfitUsd,
    notionalUsd,
    latencyMs,
    realizedVolBpsPerSecond: config.latencyVolatilityBpsPerSecond,
  });

  if (netProfitUsd < config.minNetProfitUsd) rejectionReasons.push("Negative net expectancy");

  const riskScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        Math.floor((latencyMs / config.maxLatencyMs) * 25) -
        rejectionReasons.length * 15 -
        (!buyFill.complete || !sellFill.complete ? 10 : 0),
    ),
  );

  const decision: OpportunityDecision = {
    id: [
      observedAt,
      buyBook.exchangeId,
      sellBook.exchangeId,
      buyBook.receivedAt,
      sellBook.receivedAt,
      buyBook.sequence ?? "x",
      sellBook.sequence ?? "x",
    ].join("-"),
    status: rejectionReasons.length === 0 ? "accepted" : "rejected",
    buyExchange: buyBook.exchangeId,
    sellExchange: sellBook.exchangeId,
    quoteAsset: buyBook.quoteAsset,
    observedAt,
    tradeSizeBtc,
    grossProfitUsd,
    netProfitUsd,
    buyFill: adjustedBuyFill,
    sellFill: adjustedSellFill,
    rejectionReasons: [...new Set(rejectionReasons)],
    risk: {
      score: riskScore,
      latencyPenaltyUsd,
      feeCostUsd,
      withdrawalCostUsd,
      grossProfitUsd,
      positivePnlProbability,
      reasons,
    },
    impactCurve: buildImpactCurveWithoutRecursion(buyBook, sellBook, config, observedAt),
    microstructure: {
      buy: getBookMicrostructure(buyBook),
      sell: getBookMicrostructure(sellBook),
    },
    explanation: [
      `gross = sell_notional(${round(adjustedSellFill.notional)}) - buy_notional(${round(adjustedBuyFill.notional)})`,
      `net = gross(${round(grossProfitUsd)}) - fees(${round(feeCostUsd)}) - withdrawal(${round(
        withdrawalCostUsd,
      )}) - latency(${round(latencyPenaltyUsd)}) - basis(${round(basisHaircutUsd)})`,
    ].join("; "),
  };

  return decision;
}

function buildImpactCurveWithoutRecursion(
  buyBook: OrderBookSnapshot,
  sellBook: OrderBookSnapshot,
  config: EngineConfig,
  observedAt: number,
) {
  const sizes = [0.05, 0.1, 0.25, 0.5, config.maxTradeBtc].filter(
    (size, index, values) => size > 0 && values.indexOf(size) === index,
  );
  return sizes.map((sizeBtc) => {
    const buyFill = simulateMarketFill(buyBook.asks, sizeBtc);
    const sellFill = simulateMarketFill(sellBook.bids, sizeBtc);
    const tradeSizeBtc = Math.min(buyFill.filledBtc, sellFill.filledBtc);
    const adjustedBuyFill =
      tradeSizeBtc === buyFill.filledBtc ? buyFill : simulateMarketFill(buyBook.asks, tradeSizeBtc);
    const adjustedSellFill =
      tradeSizeBtc === sellFill.filledBtc
        ? sellFill
        : simulateMarketFill(sellBook.bids, tradeSizeBtc);
    const buyFeeUsd = adjustedBuyFill.notional * feeRate(buyBook.exchangeId, config);
    const sellFeeUsd = adjustedSellFill.notional * feeRate(sellBook.exchangeId, config);
    const referencePrice = adjustedBuyFill.vwap || buyBook.asks[0]?.price || sellBook.bids[0]?.price || 0;
    const ageMs = Math.max(0, observedAt - buyBook.receivedAt, observedAt - sellBook.receivedAt);
    const grossProfitUsd = adjustedSellFill.notional - adjustedBuyFill.notional;
    const latencyPenaltyUsd =
      adjustedSellFill.notional *
      (config.latencyVolatilityBpsPerSecond / 10_000) *
      (ageMs / 1_000);
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

export function executeAcceptedTrade(
  decision: OpportunityDecision,
  wallets: WalletState,
  cumulativePnlUsd = 0,
): TradeEvent {
  if (decision.status !== "accepted") {
    throw new Error("Cannot execute a rejected opportunity");
  }

  const nextWallets = cloneWallets(wallets);
  const buyWallet = ensureWallet(nextWallets, decision.buyExchange);
  const sellWallet = ensureWallet(nextWallets, decision.sellExchange);
  const quote = decision.quoteAsset;
  const buyCost = decision.buyFill.notional;
  const sellProceeds = decision.sellFill.notional;

  buyWallet[quote] -= buyCost;
  buyWallet.BTC += decision.tradeSizeBtc;
  sellWallet.BTC -= decision.tradeSizeBtc;
  sellWallet[quote] += sellProceeds;

  return {
    id: `trade-${decision.id}`,
    executedAt: decision.observedAt,
    decision,
    wallets: nextWallets,
    cumulativePnlUsd: cumulativePnlUsd + decision.netProfitUsd,
  };
}

export function findBestOpportunity(
  books: OrderBookSnapshot[],
  wallets: WalletState,
  config: EngineConfig,
  observedAt = Date.now(),
): OpportunityDecision | undefined {
  const decisions: OpportunityDecision[] = [];
  for (const buyBook of books) {
    for (const sellBook of books) {
      if (buyBook.exchangeId === sellBook.exchangeId) continue;
      decisions.push(evaluateOpportunity(buyBook, sellBook, wallets, config, observedAt));
    }
  }
  return decisions.sort((a, b) => b.netProfitUsd - a.netProfitUsd)[0];
}

function feeRate(exchangeId: string, config: EngineConfig): number {
  return (config.feesBps[exchangeId] ?? 20) / 10_000;
}

function cloneWallets(wallets: WalletState): WalletState {
  return Object.fromEntries(
    Object.entries(wallets).map(([exchange, wallet]) => [exchange, { ...wallet }]),
  );
}

function ensureWallet(wallets: WalletState, exchangeId: string): WalletBalance {
  wallets[exchangeId] ??= { ...emptyWallet };
  return wallets[exchangeId];
}

function round(value: number): string {
  return value.toFixed(2);
}

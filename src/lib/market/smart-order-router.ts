import { defaultEngineConfig } from "./defaults";
import type { LiquidityRadar, LiquidityVenueBook } from "./liquidity-radar";
import type { QuoteAsset, WalletState } from "./types";
import type { VenueReliabilityOracle, VenueReliabilityScore } from "./venue-reliability";

export type SmartOrderSlice = {
  side: "buy" | "sell";
  exchangeId: string;
  quoteAsset: QuoteAsset;
  price: number;
  sizeBtc: number;
  notionalUsd: number;
  feeUsd: number;
  effectivePriceUsd: number;
  levelIndex: number;
  walletLimited: boolean;
  reliabilityHaircutBps: number;
};

export type SmartOrderRouterPlan = {
  generatedAt: number;
  targetSizeBtc: number;
  quoteAsset?: QuoteAsset;
  buySlices: SmartOrderSlice[];
  sellSlices: SmartOrderSlice[];
  rejectionReasons: string[];
  summary: {
    policy: "standby" | "single-route" | "split-route" | "cap-size" | "reject";
    tradeSizeBtc: number;
    buyVwap: number;
    sellVwap: number;
    grossProfitUsd: number;
    feeCostUsd: number;
    reliabilityHaircutUsd: number;
    rebalanceCostUsd: number;
    netProfitUsd: number;
    bestSingleRouteNetUsd: number;
    improvementUsd: number;
    venuesUsed: number;
    sourceCount: number;
  };
  equation: string;
};

export function buildSmartOrderRouter(input: {
  radar?: LiquidityRadar;
  wallets: WalletState;
  reliability?: VenueReliabilityOracle;
  targetSizeBtc?: number;
  observedAt?: number;
}): SmartOrderRouterPlan {
  const generatedAt = input.observedAt ?? Date.now();
  const targetSizeBtc = input.targetSizeBtc ?? input.radar?.targetSizeBtc ?? defaultEngineConfig.maxTradeBtc;
  if (!input.radar || input.radar.books.length < 2 || targetSizeBtc <= 0) {
    return emptyPlan(generatedAt, targetSizeBtc, input.radar?.summary.sourceCount ?? 0);
  }

  const reliabilityByVenue = new Map((input.reliability?.venues ?? []).map((venue) => [venue.venue as string, venue]));
  const rejectionReasons = new Set<string>();
  const books = input.radar.books.filter((book) => {
    const score = reliabilityByVenue.get(book.exchangeId);
    if (score?.policy === "halt") {
      rejectionReasons.add("venue reliability halt excluded");
      return false;
    }
    return true;
  });
  const quoteAsset = chooseQuoteAsset(books);
  const laneBooks = books.filter((book) => book.quoteAsset === quoteAsset);
  if (laneBooks.length < 2 || !quoteAsset) {
    return rejectPlan(generatedAt, targetSizeBtc, input.radar.summary.sourceCount, ["insufficient same-lane books after reliability filter"]);
  }

  const buySlices = buildSideSlices({
    side: "buy",
    books: laneBooks,
    wallets: input.wallets,
    reliabilityByVenue,
    targetSizeBtc,
  });
  const provisionalBuySize = sumSize(buySlices);
  const sellSlices = buildSideSlices({
    side: "sell",
    books: laneBooks,
    wallets: input.wallets,
    reliabilityByVenue,
    targetSizeBtc: Math.min(targetSizeBtc, provisionalBuySize),
  });
  const tradeSizeBtc = Math.min(targetSizeBtc, provisionalBuySize, sumSize(sellSlices));
  const adjustedBuys = trimSlices(buySlices, tradeSizeBtc);
  const adjustedSells = trimSlices(sellSlices, tradeSizeBtc);
  const buyNotional = sumNotional(adjustedBuys);
  const sellNotional = sumNotional(adjustedSells);
  const feeCostUsd = sumFees(adjustedBuys) + sumFees(adjustedSells);
  const reliabilityHaircutUsd = round(
    [...adjustedBuys, ...adjustedSells].reduce(
      (sum, slice) => sum + slice.notionalUsd * (slice.reliabilityHaircutBps / 10_000),
      0,
    ),
  );
  const referencePrice = buyNotional > 0 && tradeSizeBtc > 0 ? buyNotional / tradeSizeBtc : laneBooks[0]?.topAsk ?? 70_000;
  const rebalanceCostUsd = round(defaultEngineConfig.withdrawalFeeBtc * referencePrice);
  const grossProfitUsd = round(sellNotional - buyNotional);
  const netProfitUsd = round(grossProfitUsd - feeCostUsd - reliabilityHaircutUsd - rebalanceCostUsd);
  const bestSingleRouteNetUsd = input.radar.routes.find((route) => route.quoteAsset === quoteAsset)?.netProfitUsd ?? 0;
  const venuesUsed = new Set([...adjustedBuys, ...adjustedSells].map((slice) => slice.exchangeId)).size;

  if (tradeSizeBtc < targetSizeBtc) rejectionReasons.add("prefunded wallet capacity capped route size");
  if (tradeSizeBtc <= 0) rejectionReasons.add("no executable smart-route depth");
  if (netProfitUsd <= 0) rejectionReasons.add("negative smart-route net after costs");
  const split = new Set(adjustedBuys.map((slice) => slice.exchangeId)).size > 1 || new Set(adjustedSells.map((slice) => slice.exchangeId)).size > 1;
  const policy =
    tradeSizeBtc <= 0 || netProfitUsd <= 0
      ? "reject"
      : tradeSizeBtc < targetSizeBtc
        ? "cap-size"
        : split
          ? "split-route"
          : "single-route";

  return {
    generatedAt,
    targetSizeBtc,
    quoteAsset,
    buySlices: adjustedBuys,
    sellSlices: adjustedSells,
    rejectionReasons: [...rejectionReasons],
    summary: {
      policy,
      tradeSizeBtc: round(tradeSizeBtc, 8),
      buyVwap: tradeSizeBtc > 0 ? round(buyNotional / tradeSizeBtc) : 0,
      sellVwap: tradeSizeBtc > 0 ? round(sellNotional / tradeSizeBtc) : 0,
      grossProfitUsd,
      feeCostUsd: round(feeCostUsd),
      reliabilityHaircutUsd,
      rebalanceCostUsd,
      netProfitUsd,
      bestSingleRouteNetUsd: round(bestSingleRouteNetUsd),
      improvementUsd: round(netProfitUsd - bestSingleRouteNetUsd),
      venuesUsed,
      sourceCount: input.radar.summary.sourceCount,
    },
    equation:
      "marginal_edge = best_sell_effective_price - best_buy_effective_price; buy_effective = ask*(1+fee_bps+reliability_bps); sell_effective = bid*(1-fee_bps-reliability_bps); smart_net = sell_notional - buy_notional - fees - reliability_haircut - rebalance_cost",
  };
}

function buildSideSlices(input: {
  side: "buy" | "sell";
  books: LiquidityVenueBook[];
  wallets: WalletState;
  reliabilityByVenue: Map<string, VenueReliabilityScore>;
  targetSizeBtc: number;
}): SmartOrderSlice[] {
  const remainingByVenue = new Map<string, number>();
  for (const book of input.books) {
    const wallet = input.wallets[book.exchangeId] ?? { BTC: 0, USD: 0, USDT: 0 };
    remainingByVenue.set(
      book.exchangeId,
      input.side === "buy" ? (book.quoteAsset === "USD" ? wallet.USD : wallet.USDT) : wallet.BTC,
    );
  }
  const candidates = input.books.flatMap((book) => {
    const reliability = input.reliabilityByVenue.get(book.exchangeId);
    const reliabilityHaircutBps = reliability?.totalHaircutBps ?? 0;
    const feeBps = defaultEngineConfig.feesBps[book.exchangeId] ?? 25;
    const costBps = feeBps + reliabilityHaircutBps;
    const levels = input.side === "buy" ? book.asks : book.bids;
    return levels.map((level, levelIndex) => ({
      book,
      level,
      levelIndex,
      reliabilityHaircutBps,
      feeBps,
      costBps,
      effectivePriceUsd:
        input.side === "buy"
          ? level.price * (1 + costBps / 10_000)
          : level.price * (1 - costBps / 10_000),
    }));
  });
  candidates.sort((a, b) =>
    input.side === "buy"
      ? a.effectivePriceUsd - b.effectivePriceUsd
      : b.effectivePriceUsd - a.effectivePriceUsd,
  );

  const slices: SmartOrderSlice[] = [];
  let remainingTarget = input.targetSizeBtc;
  for (const candidate of candidates) {
    if (remainingTarget <= 0) break;
    const walletRemaining = remainingByVenue.get(candidate.book.exchangeId) ?? 0;
    const walletCapacityBtc =
      input.side === "buy"
        ? walletRemaining / (candidate.level.price * (1 + candidate.costBps / 10_000))
        : walletRemaining;
    const sizeBtc = Math.min(candidate.level.size, remainingTarget, walletCapacityBtc);
    if (sizeBtc <= 0) continue;
    const notionalUsd = sizeBtc * candidate.level.price;
    const feeUsd = notionalUsd * (candidate.feeBps / 10_000);
    const buyDebitUsd = notionalUsd * (1 + candidate.costBps / 10_000);
    slices.push({
      side: input.side,
      exchangeId: candidate.book.exchangeId,
      quoteAsset: candidate.book.quoteAsset,
      price: candidate.level.price,
      sizeBtc: round(sizeBtc, 8),
      notionalUsd: round(notionalUsd),
      feeUsd: round(feeUsd),
      effectivePriceUsd: round(candidate.effectivePriceUsd),
      levelIndex: candidate.levelIndex,
      walletLimited: walletCapacityBtc <= sizeBtc + 1e-9,
      reliabilityHaircutBps: candidate.reliabilityHaircutBps,
    });
    remainingTarget -= sizeBtc;
    remainingByVenue.set(candidate.book.exchangeId, input.side === "buy" ? walletRemaining - buyDebitUsd : walletRemaining - sizeBtc);
  }
  return slices;
}

function chooseQuoteAsset(books: LiquidityVenueBook[]): QuoteAsset | undefined {
  const usdBooks = books.filter((book) => book.quoteAsset === "USD").length;
  const usdtBooks = books.filter((book) => book.quoteAsset === "USDT").length;
  if (usdBooks >= 2 && usdBooks >= usdtBooks) return "USD";
  if (usdtBooks >= 2) return "USDT";
  return undefined;
}

function trimSlices(slices: SmartOrderSlice[], targetSizeBtc: number): SmartOrderSlice[] {
  const result: SmartOrderSlice[] = [];
  let remaining = targetSizeBtc;
  for (const slice of slices) {
    if (remaining <= 0) break;
    const sizeBtc = Math.min(slice.sizeBtc, remaining);
    const ratio = slice.sizeBtc > 0 ? sizeBtc / slice.sizeBtc : 0;
    result.push({
      ...slice,
      sizeBtc: round(sizeBtc, 8),
      notionalUsd: round(slice.notionalUsd * ratio),
      feeUsd: round(slice.feeUsd * ratio),
    });
    remaining -= sizeBtc;
  }
  return result;
}

function emptyPlan(generatedAt: number, targetSizeBtc: number, sourceCount: number): SmartOrderRouterPlan {
  return {
    generatedAt,
    targetSizeBtc,
    buySlices: [],
    sellSlices: [],
    rejectionReasons: ["waiting for liquidity radar books"],
    summary: {
      policy: "standby",
      tradeSizeBtc: 0,
      buyVwap: 0,
      sellVwap: 0,
      grossProfitUsd: 0,
      feeCostUsd: 0,
      reliabilityHaircutUsd: 0,
      rebalanceCostUsd: 0,
      netProfitUsd: 0,
      bestSingleRouteNetUsd: 0,
      improvementUsd: 0,
      venuesUsed: 0,
      sourceCount,
    },
    equation:
      "marginal_edge = best_sell_effective_price - best_buy_effective_price; smart_net = sell_notional - buy_notional - costs",
  };
}

function rejectPlan(generatedAt: number, targetSizeBtc: number, sourceCount: number, reasons: string[]): SmartOrderRouterPlan {
  const plan = emptyPlan(generatedAt, targetSizeBtc, sourceCount);
  return {
    ...plan,
    rejectionReasons: reasons,
    summary: { ...plan.summary, policy: "reject" },
  };
}

function sumSize(slices: SmartOrderSlice[]): number {
  return slices.reduce((sum, slice) => sum + slice.sizeBtc, 0);
}

function sumNotional(slices: SmartOrderSlice[]): number {
  return slices.reduce((sum, slice) => sum + slice.notionalUsd, 0);
}

function sumFees(slices: SmartOrderSlice[]): number {
  return slices.reduce((sum, slice) => sum + slice.feeUsd, 0);
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

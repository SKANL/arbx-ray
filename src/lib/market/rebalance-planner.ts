import type { WalletState } from "./types";

export type RebalanceVenue = {
  exchangeId: string;
  quoteAsset: "USD" | "USDT";
  btc: number;
  quoteUsd: number;
  totalValueUsd: number;
  btcValueUsd: number;
  btcDrift: number;
  quoteDriftUsd: number;
  buyCapacityBtc: number;
  sellCapacityBtc: number;
  status: "balanced" | "needs-btc" | "needs-quote" | "thin-both";
};

export type RebalanceAction = {
  asset: "BTC" | "USD" | "USDT";
  fromExchange: string;
  toExchange: string;
  amount: number;
  estimatedCostUsd: number;
  priority: number;
  reason: string;
  simulatedOnly: true;
};

export type RebalancePlanner = {
  generatedAt: number;
  btcUsd: number;
  fastestFeeSatVb: number;
  policy: "rebalance-ok" | "cap-to-internal-inventory" | "defer-noncritical";
  venues: RebalanceVenue[];
  actions: RebalanceAction[];
  summary: {
    totalCapitalUsd: number;
    btcAllocationPct: number;
    buyConstrainedVenues: number;
    sellConstrainedVenues: number;
    estimatedTotalRebalanceCostUsd: number;
    maxRouteSizeBtc: number;
  };
};

export function buildRebalancePlanner(input: {
  wallets: WalletState;
  btcUsd: number;
  fastestFeeSatVb?: number;
  targetBtcPerVenue?: number;
  targetQuoteUsdPerVenue?: number;
  generatedAt?: number;
}): RebalancePlanner {
  const btcUsd = input.btcUsd > 0 ? input.btcUsd : 70_000;
  const fastestFeeSatVb = Math.max(0, input.fastestFeeSatVb ?? 0);
  const targetBtcPerVenue = input.targetBtcPerVenue ?? 1;
  const targetQuoteUsdPerVenue = input.targetQuoteUsdPerVenue ?? 75_000;
  const venues: RebalanceVenue[] = Object.entries(input.wallets).map(([exchangeId, wallet]) => {
    const quoteAsset: RebalanceVenue["quoteAsset"] = wallet.USD >= wallet.USDT ? "USD" : "USDT";
    const quoteUsd = wallet.USD + wallet.USDT;
    const btcValueUsd = wallet.BTC * btcUsd;
    const btcDrift = wallet.BTC - targetBtcPerVenue;
    const quoteDriftUsd = quoteUsd - targetQuoteUsdPerVenue;
    const buyCapacityBtc = quoteUsd / btcUsd;
    const sellCapacityBtc = wallet.BTC;
    return {
      exchangeId,
      quoteAsset,
      btc: wallet.BTC,
      quoteUsd,
      totalValueUsd: quoteUsd + btcValueUsd,
      btcValueUsd,
      btcDrift,
      quoteDriftUsd,
      buyCapacityBtc,
      sellCapacityBtc,
      status: classifyVenue(wallet.BTC, quoteUsd, targetBtcPerVenue, targetQuoteUsdPerVenue),
    };
  });

  const actions = buildActions(venues, btcUsd, fastestFeeSatVb);
  const totalCapitalUsd = venues.reduce((sum, venue) => sum + venue.totalValueUsd, 0);
  const btcValueUsd = venues.reduce((sum, venue) => sum + venue.btcValueUsd, 0);
  const estimatedTotalRebalanceCostUsd = actions.reduce((sum, action) => sum + action.estimatedCostUsd, 0);
  const routeSizes = venues.map((venue) => Math.max(0, Math.min(venue.buyCapacityBtc, venue.sellCapacityBtc)));

  return {
    generatedAt: input.generatedAt ?? Date.now(),
    btcUsd,
    fastestFeeSatVb,
    policy:
      fastestFeeSatVb >= 60
        ? "defer-noncritical"
        : actions.some((action) => action.priority >= 80)
          ? "cap-to-internal-inventory"
          : "rebalance-ok",
    venues: venues.sort((a, b) => Math.abs(b.btcDrift) - Math.abs(a.btcDrift)),
    actions,
    summary: {
      totalCapitalUsd,
      btcAllocationPct: totalCapitalUsd > 0 ? (btcValueUsd / totalCapitalUsd) * 100 : 0,
      buyConstrainedVenues: venues.filter((venue) => venue.buyCapacityBtc < 0.25).length,
      sellConstrainedVenues: venues.filter((venue) => venue.sellCapacityBtc < 0.25).length,
      estimatedTotalRebalanceCostUsd,
      maxRouteSizeBtc: routeSizes.length > 0 ? Math.min(...routeSizes) : 0,
    },
  };
}

function buildActions(
  venues: RebalanceVenue[],
  btcUsd: number,
  fastestFeeSatVb: number,
): RebalanceAction[] {
  const costUsd = estimateBtcTransferCostUsd(btcUsd, fastestFeeSatVb);
  const surplus = venues
    .filter((venue) => venue.btcDrift > 0.1)
    .sort((a, b) => b.btcDrift - a.btcDrift)
    .map((venue) => ({ ...venue, remaining: venue.btcDrift }));
  const deficit = venues
    .filter((venue) => venue.btcDrift < -0.1)
    .sort((a, b) => a.btcDrift - b.btcDrift)
    .map((venue) => ({ ...venue, remaining: Math.abs(venue.btcDrift) }));
  const actions: RebalanceAction[] = [];

  for (const need of deficit) {
    for (const source of surplus) {
      if (need.remaining <= 0) break;
      if (source.remaining <= 0) continue;
      const amount = Math.min(need.remaining, source.remaining);
      if (amount <= 0) continue;
      source.remaining -= amount;
      need.remaining -= amount;
      actions.push({
        asset: "BTC",
        fromExchange: source.exchangeId,
        toExchange: need.exchangeId,
        amount,
        estimatedCostUsd: costUsd,
        priority: scorePriority(amount, need.status, fastestFeeSatVb),
        reason: `${need.exchangeId} cannot sell enough BTC; move simulated inventory from ${source.exchangeId}.`,
        simulatedOnly: true,
      });
    }
  }

  return actions.sort((a, b) => b.priority - a.priority || b.amount - a.amount);
}

function classifyVenue(
  btc: number,
  quoteUsd: number,
  targetBtcPerVenue: number,
  targetQuoteUsdPerVenue: number,
): RebalanceVenue["status"] {
  const needsBtc = btc < targetBtcPerVenue * 0.4;
  const needsQuote = quoteUsd < targetQuoteUsdPerVenue * 0.4;
  if (needsBtc && needsQuote) return "thin-both";
  if (needsBtc) return "needs-btc";
  if (needsQuote) return "needs-quote";
  return "balanced";
}

function estimateBtcTransferCostUsd(btcUsd: number, fastestFeeSatVb: number): number {
  const virtualBytes = 140;
  const networkBtc = (fastestFeeSatVb * virtualBytes) / 100_000_000;
  const operationalBufferBtc = 0.00004;
  return (networkBtc + operationalBufferBtc) * btcUsd;
}

function scorePriority(
  amountBtc: number,
  status: RebalanceVenue["status"],
  fastestFeeSatVb: number,
): number {
  const statusBoost = status === "thin-both" ? 30 : status === "needs-btc" ? 22 : 10;
  const feePenalty = fastestFeeSatVb >= 60 ? 12 : fastestFeeSatVb >= 25 ? 5 : 0;
  return Math.max(0, Math.min(100, 45 + Math.min(25, amountBtc * 18) + statusBoost - feePenalty));
}

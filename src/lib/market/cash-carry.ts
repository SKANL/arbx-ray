export type CarrySpotVenue = {
  venue: string;
  label: string;
  pair: string;
  priceUsd: number;
  takerFeeBps: number;
  receivedAt: number;
  source: string;
};

export type CarryPerpVenue = {
  venue: string;
  label: string;
  instrument: string;
  markPriceUsd: number;
  indexPriceUsd?: number;
  fundingRate8h: number;
  takerFeeBps: number;
  openInterestUsd?: number;
  volumeUsd24h?: number;
  receivedAt: number;
  source: string;
  exchangeTimestamp?: number;
};

export type CarryRoute = {
  id: string;
  spotVenue: string;
  perpVenue: string;
  direction: "cash-and-carry" | "reverse-carry";
  notionalUsd: number;
  basisBps: number;
  annualizedBasisPct: number;
  annualizedFundingPct: number;
  expectedGrossUsd: number;
  expectedFundingUsd: number;
  feeCostUsd: number;
  rebalanceCostUsd: number;
  stressLossUsd: number;
  expectedNetUsd: number;
  expectedNetAprPct: number;
  liquidationBufferPct: number;
  score: number;
  action: "open-carry" | "monitor" | "skip" | "halt";
  rejectionReasons: string[];
  formula: string;
};

export type CashCarryLab = {
  generatedAt: number;
  holdingDays: number;
  notionalUsd: number;
  routes: CarryRoute[];
  summary: {
    spotCount: number;
    perpCount: number;
    bestRouteId?: string;
    bestNetUsd: number;
    bestAprPct: number;
    executableRoutes: number;
    maxBasisBps: number;
    maxFundingAprPct: number;
    recommendedAction: CarryRoute["action"];
  };
  explanation: string;
  sources: string[];
  errors: string[];
};

export function parseDeribitCarryPerp(payload: unknown, receivedAt = Date.now()): CarryPerpVenue | undefined {
  if (!isRecord(payload) || !isRecord(payload.result)) return undefined;
  const row = payload.result;
  const mark = numberValue(row.mark_price);
  const index = numberValue(row.index_price);
  const fundingRate8h = numberValue(row.funding_8h);
  if (!isFinitePositive(mark) || !Number.isFinite(fundingRate8h)) return undefined;
  return {
    venue: "deribit",
    label: "Deribit",
    instrument: String(row.instrument_name ?? "BTC-PERPETUAL"),
    markPriceUsd: mark,
    indexPriceUsd: isFinitePositive(index) ? index : undefined,
    fundingRate8h,
    takerFeeBps: 5,
    openInterestUsd: numberValue(row.open_interest) || undefined,
    volumeUsd24h: isRecord(row.stats) ? numberValue(row.stats.volume_usd) || undefined : undefined,
    receivedAt,
    source: "https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL",
    exchangeTimestamp: numberValue(row.timestamp) || undefined,
  };
}

export function parseOkxCarryPerp(
  fundingPayload: unknown,
  tickerPayload: unknown,
  receivedAt = Date.now(),
): CarryPerpVenue | undefined {
  if (!isRecord(fundingPayload) || !Array.isArray(fundingPayload.data) || !isRecord(fundingPayload.data[0])) {
    return undefined;
  }
  if (!isRecord(tickerPayload) || !Array.isArray(tickerPayload.data) || !isRecord(tickerPayload.data[0])) {
    return undefined;
  }
  const funding = fundingPayload.data[0];
  const ticker = tickerPayload.data[0];
  const mark = numberValue(ticker.last);
  const fundingRate8h = numberValue(funding.fundingRate);
  if (!isFinitePositive(mark) || !Number.isFinite(fundingRate8h)) return undefined;
  const volumeBtc = numberValue(ticker.volCcy24h);
  return {
    venue: "okx",
    label: "OKX",
    instrument: String(funding.instId ?? ticker.instId ?? "BTC-USDT-SWAP"),
    markPriceUsd: mark,
    fundingRate8h,
    takerFeeBps: 5,
    volumeUsd24h: isFinitePositive(volumeBtc) ? volumeBtc * mark : undefined,
    receivedAt,
    source: "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP",
    exchangeTimestamp: numberValue(ticker.ts) || numberValue(funding.ts) || undefined,
  };
}

export function parseBitmexCarryPerp(payload: unknown, receivedAt = Date.now()): CarryPerpVenue | undefined {
  if (!Array.isArray(payload) || !isRecord(payload[0])) return undefined;
  const row = payload[0];
  const mark = numberValue(row.markPrice);
  const index = numberValue(row.indicativeSettlePrice);
  const fundingRate8h = numberValue(row.fundingRate);
  if (!isFinitePositive(mark) || !Number.isFinite(fundingRate8h)) return undefined;
  return {
    venue: "bitmex",
    label: "BitMEX",
    instrument: String(row.symbol ?? "XBTUSDT"),
    markPriceUsd: mark,
    indexPriceUsd: isFinitePositive(index) ? index : undefined,
    fundingRate8h,
    takerFeeBps: 7.5,
    openInterestUsd: numberValue(row.openInterest) || undefined,
    volumeUsd24h: numberValue(row.foreignNotional24h) || undefined,
    receivedAt,
    source: "https://www.bitmex.com/api/v1/instrument?symbol=XBTUSDT",
    exchangeTimestamp: typeof row.timestamp === "string" ? Date.parse(row.timestamp) : undefined,
  };
}

export function buildCashCarryLab(input: {
  spots: Array<CarrySpotVenue | undefined>;
  perps: Array<CarryPerpVenue | undefined>;
  generatedAt?: number;
  holdingDays?: number;
  notionalUsd?: number;
  rebalanceCostBps?: number;
  stressBasisShockBps?: number;
  initialMarginPct?: number;
  maintenanceMarginPct?: number;
  staleMs?: number;
  errors?: string[];
}): CashCarryLab {
  const generatedAt = input.generatedAt ?? Date.now();
  const holdingDays = input.holdingDays ?? 7;
  const notionalUsd = input.notionalUsd ?? 25_000;
  const rebalanceCostBps = input.rebalanceCostBps ?? 4;
  const stressBasisShockBps = input.stressBasisShockBps ?? 120;
  const initialMarginPct = input.initialMarginPct ?? 35;
  const maintenanceMarginPct = input.maintenanceMarginPct ?? 5;
  const staleMs = input.staleMs ?? 120_000;
  const spots = input.spots.filter((spot): spot is CarrySpotVenue => spot !== undefined && isFinitePositive(spot.priceUsd));
  const perps = input.perps.filter((perp): perp is CarryPerpVenue => perp !== undefined && isFinitePositive(perp.markPriceUsd));
  const periods = (holdingDays * 24) / 8;

  const routes = spots.flatMap((spot) =>
    perps.map((perp): CarryRoute => {
      const direction = perp.markPriceUsd >= spot.priceUsd ? "cash-and-carry" : "reverse-carry";
      const sideSign = direction === "cash-and-carry" ? 1 : -1;
      const basisBps = ((perp.markPriceUsd - spot.priceUsd) / spot.priceUsd) * 10_000;
      const annualizedBasisPct = (basisBps / 10_000) * (365 / holdingDays) * 100;
      const annualizedFundingPct = perp.fundingRate8h * 3 * 365 * 100 * sideSign;
      const expectedGrossUsd = notionalUsd * Math.abs(basisBps / 10_000);
      const expectedFundingUsd = notionalUsd * perp.fundingRate8h * periods * sideSign;
      const feeCostUsd = notionalUsd * ((spot.takerFeeBps + perp.takerFeeBps) / 10_000);
      const rebalanceCostUsd = notionalUsd * (rebalanceCostBps / 10_000);
      const stressLossUsd = notionalUsd * (stressBasisShockBps / 10_000);
      const expectedNetUsd = expectedGrossUsd + expectedFundingUsd - feeCostUsd - rebalanceCostUsd - stressLossUsd;
      const expectedNetAprPct = (expectedNetUsd / notionalUsd) * (365 / holdingDays) * 100;
      const perpAgeMs = Math.max(0, generatedAt - (perp.exchangeTimestamp ?? perp.receivedAt));
      const spotAgeMs = Math.max(0, generatedAt - spot.receivedAt);
      const liquidityScore = Math.min(25, Math.log10(Math.max(1, perp.openInterestUsd ?? perp.volumeUsd24h ?? 1)) * 2.4);
      const liquidationBufferPct = Math.max(
        0,
        initialMarginPct - maintenanceMarginPct - Math.abs(basisBps) / 100 - stressBasisShockBps / 100,
      );
      const rejectionReasons = [
        ...(perpAgeMs > staleMs || spotAgeMs > staleMs ? ["stale public market data"] : []),
        ...(Math.abs(basisBps) < 8 ? ["basis too small"] : []),
        ...(expectedNetUsd <= 0 ? ["negative stressed carry P&L"] : []),
        ...(liquidationBufferPct < 10 ? ["thin liquidation buffer"] : []),
        ...((perp.openInterestUsd ?? perp.volumeUsd24h ?? 0) < 50_000_000 ? ["weak derivatives liquidity"] : []),
      ];
      const score = clampScore(
        45 +
          Math.min(22, Math.abs(basisBps) * 0.5) +
          Math.min(18, Math.max(0, annualizedFundingPct) * 0.45) +
          Math.min(15, Math.max(0, expectedNetAprPct) * 0.55) +
          liquidityScore +
          Math.min(12, liquidationBufferPct * 0.35) -
          rejectionReasons.length * 14,
      );
      const action =
        rejectionReasons.some((reason) => reason.includes("stale") || reason.includes("liquidation"))
          ? "halt"
          : expectedNetUsd > 0 && score >= 78
            ? "open-carry"
            : expectedNetUsd > 0 && score >= 58
              ? "monitor"
              : "skip";

      return {
        id: `${spot.venue}-${perp.venue}-${direction}`,
        spotVenue: spot.label,
        perpVenue: perp.label,
        direction,
        notionalUsd,
        basisBps: round(basisBps, 2),
        annualizedBasisPct: round(annualizedBasisPct, 2),
        annualizedFundingPct: round(annualizedFundingPct, 2),
        expectedGrossUsd: round(expectedGrossUsd),
        expectedFundingUsd: round(expectedFundingUsd),
        feeCostUsd: round(feeCostUsd),
        rebalanceCostUsd: round(rebalanceCostUsd),
        stressLossUsd: round(stressLossUsd),
        expectedNetUsd: round(expectedNetUsd),
        expectedNetAprPct: round(expectedNetAprPct, 2),
        liquidationBufferPct: round(liquidationBufferPct, 2),
        score,
        action,
        rejectionReasons,
        formula:
          "net = |basis| * notional + funding_rate_8h * periods * side * notional - taker_fees - rebalance - adverse_basis_stress",
      };
    }),
  ).sort((a, b) => b.score - a.score || b.expectedNetUsd - a.expectedNetUsd);
  const best = routes[0];

  return {
    generatedAt,
    holdingDays,
    notionalUsd,
    routes,
    summary: {
      spotCount: spots.length,
      perpCount: perps.length,
      bestRouteId: best?.id,
      bestNetUsd: best?.expectedNetUsd ?? 0,
      bestAprPct: best?.expectedNetAprPct ?? 0,
      executableRoutes: routes.filter((route) => route.action === "open-carry" || route.action === "monitor").length,
      maxBasisBps: routes.reduce((max, route) => Math.max(max, Math.abs(route.basisBps)), 0),
      maxFundingAprPct: routes.reduce((max, route) => Math.max(max, route.annualizedFundingPct), Number.NEGATIVE_INFINITY) || 0,
      recommendedAction: best?.action ?? "skip",
    },
    explanation:
      "Cash-and-carry buys spot and shorts a rich perpetual, or simulates reverse carry when the perpetual is cheap. The lab annualizes basis, projects funding, subtracts fees/rebalance, then applies an adverse basis stress and liquidation buffer gate.",
    sources: uniqueStrings([...spots.map((spot) => spot.source), ...perps.map((perp) => perp.source)]),
    errors: input.errors ?? [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

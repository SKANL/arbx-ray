export type DerivativesVenuePressure = {
  venue: string;
  label: string;
  instrument: string;
  fundingRate8h: number;
  premiumBps: number;
  openInterestUsd?: number;
  notionalVolumeUsd24h?: number;
  nextFundingTime?: number;
  receivedAt: number;
  source: string;
  exchangeTimestamp?: number;
};

export type DerivativesVenuePressureScore = DerivativesVenuePressure & {
  fundingBps8h: number;
  annualizedFundingPct: number;
  ageMs: number;
  state: "normal" | "crowded" | "dislocated" | "stale";
};

export type DerivativesPressureOracle = {
  generatedAt: number;
  venues: DerivativesVenuePressureScore[];
  summary: {
    sourceCount: number;
    staleCount: number;
    crowdedCount: number;
    dislocatedCount: number;
    medianFundingBps8h: number;
    medianPremiumBps: number;
    disagreementBps: number;
    totalOpenInterestUsd: number;
    spotExecutionHaircutBps: number;
    direction: "long-crowded" | "short-crowded" | "balanced";
    riskState: "normal" | "caution" | "halt";
  };
  explanation: string;
  sources: string[];
  errors: string[];
};

export function parseOkxFundingRate(payload: unknown, receivedAt = Date.now()): DerivativesVenuePressure | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data) || !isRecord(payload.data[0])) return undefined;
  const row = payload.data[0];
  const fundingRate8h = numberValue(row.fundingRate);
  if (!Number.isFinite(fundingRate8h)) return undefined;
  const premium = numberValue(row.premium);
  return {
    venue: "okx",
    label: "OKX",
    instrument: String(row.instId ?? "BTC-USDT-SWAP"),
    fundingRate8h,
    premiumBps: Number.isFinite(premium) ? premium * 10_000 : 0,
    nextFundingTime: numberValue(row.nextFundingTime || row.fundingTime) || undefined,
    receivedAt,
    source: "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP",
    exchangeTimestamp: numberValue(row.ts) || undefined,
  };
}

export function parseOkxSwapTicker(payload: unknown, receivedAt = Date.now()): Pick<DerivativesVenuePressure, "notionalVolumeUsd24h" | "exchangeTimestamp"> | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data) || !isRecord(payload.data[0])) return undefined;
  const row = payload.data[0];
  const last = numberValue(row.last);
  const volumeBtc = numberValue(row.volCcy24h);
  if (!isFinitePositive(last) || !isFinitePositive(volumeBtc)) return undefined;
  return {
    notionalVolumeUsd24h: last * volumeBtc,
    exchangeTimestamp: numberValue(row.ts) || receivedAt,
  };
}

export function parseDeribitTicker(payload: unknown, receivedAt = Date.now()): DerivativesVenuePressure | undefined {
  if (!isRecord(payload) || !isRecord(payload.result)) return undefined;
  const row = payload.result;
  const fundingRate8h = numberValue(row.funding_8h);
  const mark = numberValue(row.mark_price);
  const index = numberValue(row.index_price);
  if (!Number.isFinite(fundingRate8h) || !isFinitePositive(mark) || !isFinitePositive(index)) return undefined;
  return {
    venue: "deribit",
    label: "Deribit",
    instrument: String(row.instrument_name ?? "BTC-PERPETUAL"),
    fundingRate8h,
    premiumBps: ((mark - index) / index) * 10_000,
    openInterestUsd: numberValue(row.open_interest) || undefined,
    notionalVolumeUsd24h: isRecord(row.stats) ? numberValue(row.stats.volume_usd) || undefined : undefined,
    receivedAt,
    source: "https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL",
    exchangeTimestamp: numberValue(row.timestamp) || undefined,
  };
}

export function parseBitmexInstrument(payload: unknown, receivedAt = Date.now()): DerivativesVenuePressure | undefined {
  if (!Array.isArray(payload) || !isRecord(payload[0])) return undefined;
  const row = payload[0];
  const fundingRate8h = numberValue(row.fundingRate);
  const mark = numberValue(row.markPrice);
  const index = numberValue(row.indicativeSettlePrice);
  if (!Number.isFinite(fundingRate8h) || !isFinitePositive(mark) || !isFinitePositive(index)) return undefined;
  const openInterestContracts = numberValue(row.openInterest);
  const last = numberValue(row.lastPrice);
  return {
    venue: "bitmex",
    label: "BitMEX",
    instrument: String(row.symbol ?? "XBTUSDT"),
    fundingRate8h,
    premiumBps: ((mark - index) / index) * 10_000,
    openInterestUsd: isFinitePositive(openInterestContracts) ? openInterestContracts : undefined,
    notionalVolumeUsd24h: isFinitePositive(numberValue(row.foreignNotional24h))
      ? numberValue(row.foreignNotional24h)
      : isFinitePositive(numberValue(row.homeNotional24h)) && isFinitePositive(last)
        ? numberValue(row.homeNotional24h) * last
        : undefined,
    nextFundingTime: typeof row.fundingTimestamp === "string" ? Date.parse(row.fundingTimestamp) : undefined,
    receivedAt,
    source: "https://www.bitmex.com/api/v1/instrument?symbol=XBTUSDT",
    exchangeTimestamp: typeof row.timestamp === "string" ? Date.parse(row.timestamp) : undefined,
  };
}

export function buildDerivativesPressureOracle(input: {
  venues: Array<DerivativesVenuePressure | undefined>;
  generatedAt?: number;
  staleMs?: number;
  errors?: string[];
}): DerivativesPressureOracle {
  const generatedAt = input.generatedAt ?? Date.now();
  const staleMs = input.staleMs ?? 90_000;
  const venues = input.venues.filter((venue): venue is DerivativesVenuePressure => Boolean(venue));
  const fresh = venues.filter((venue) => generatedAt - (venue.exchangeTimestamp ?? venue.receivedAt) <= staleMs);
  const evidence = fresh.length >= 2 ? fresh : venues;
  const fundingBps = evidence.map((venue) => venue.fundingRate8h * 10_000).sort((a, b) => a - b);
  const premiumBps = evidence.map((venue) => venue.premiumBps).sort((a, b) => a - b);
  const medianFundingBps8h = median(fundingBps);
  const medianPremiumBps = median(premiumBps);
  const disagreementBps = Math.max(0, ...premiumBps) - Math.min(0, ...premiumBps);

  const scored = venues
    .map((venue): DerivativesVenuePressureScore => {
      const ageMs = Math.max(0, generatedAt - (venue.exchangeTimestamp ?? venue.receivedAt));
      const fundingBps8h = venue.fundingRate8h * 10_000;
      const annualizedFundingPct = venue.fundingRate8h * 3 * 365 * 100;
      const state =
        ageMs > staleMs
          ? "stale"
          : Math.abs(venue.premiumBps) >= 30 || Math.abs(fundingBps8h) >= 2
            ? "dislocated"
            : Math.abs(venue.premiumBps) >= 5 || Math.abs(fundingBps8h) >= 0.5
              ? "crowded"
              : "normal";
      return {
        ...venue,
        fundingBps8h,
        annualizedFundingPct,
        ageMs,
        state,
      };
    })
    .sort((a, b) => Math.abs(b.premiumBps) + Math.abs(b.fundingBps8h) - (Math.abs(a.premiumBps) + Math.abs(a.fundingBps8h)));

  const staleCount = scored.filter((venue) => venue.state === "stale").length;
  const crowdedCount = scored.filter((venue) => venue.state === "crowded").length;
  const dislocatedCount = scored.filter((venue) => venue.state === "dislocated").length;
  const totalOpenInterestUsd = scored.reduce((sum, venue) => sum + (venue.openInterestUsd ?? 0), 0);
  const spotExecutionHaircutBps = round(
    Math.abs(medianFundingBps8h) * 1.8 +
      Math.abs(medianPremiumBps) * 0.35 +
      disagreementBps * 0.12 +
      staleCount * 1.5 +
      dislocatedCount * 2,
    2,
  );
  const direction =
    medianFundingBps8h >= 0.45 && medianPremiumBps >= 2
      ? "long-crowded"
      : medianFundingBps8h <= -0.45 && medianPremiumBps <= -2
        ? "short-crowded"
        : "balanced";
  const riskState =
    staleCount > 0 || dislocatedCount >= 2 || disagreementBps >= 50 || spotExecutionHaircutBps >= 12
      ? "halt"
      : crowdedCount > 0 || dislocatedCount > 0 || spotExecutionHaircutBps >= 2
        ? "caution"
        : "normal";

  return {
    generatedAt,
    venues: scored,
    summary: {
      sourceCount: venues.length,
      staleCount,
      crowdedCount,
      dislocatedCount,
      medianFundingBps8h,
      medianPremiumBps,
      disagreementBps,
      totalOpenInterestUsd,
      spotExecutionHaircutBps,
      direction,
      riskState,
    },
    explanation:
      "funding_bps_8h = funding_rate_8h * 10000; premium_bps = (mark - index) / index * 10000; spot_haircut_bps = |median_funding| * 1.8 + |median_premium| * 0.35 + disagreement * 0.12 + stale/dislocation penalties",
    sources: uniqueStrings(venues.map((venue) => venue.source)),
    errors: input.errors ?? [],
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2
    : values[middle] ?? 0;
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

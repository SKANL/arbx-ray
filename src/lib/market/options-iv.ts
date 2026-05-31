export type OptionType = "call" | "put";

export type OptionIvQuote = {
  instrumentName: string;
  optionType: OptionType;
  strikeUsd: number;
  expiryTimestamp: number;
  markIvPct: number;
  underlyingPriceUsd: number;
  estimatedDeliveryPriceUsd: number;
  bidPriceBtc?: number;
  askPriceBtc?: number;
  markPriceBtc?: number;
  openInterestBtc?: number;
  volumeUsd?: number;
  receivedAt: number;
  source: string;
};

export type SelectedOptionIvQuote = OptionIvQuote & {
  moneynessPct: number;
  timeToExpiryDays: number;
  liquidityScore: number;
};

export type OptionsIvOracle = {
  generatedAt: number;
  indexPriceUsd: number;
  selected: SelectedOptionIvQuote[];
  termBuckets: Array<{
    expiry: string;
    daysToExpiry: number;
    quoteCount: number;
    medianIvPct: number;
    openInterestBtc: number;
    volumeUsd: number;
  }>;
  summary: {
    sourceCount: number;
    selectedCount: number;
    atmIvPct: number;
    expectedMove1hUsd: number;
    expectedMove1hBps: number;
    expectedMove1dUsd: number;
    expectedMove1dBps: number;
    executionHaircutBps: number;
    liquidityState: "liquid" | "mixed" | "thin";
    regime: "calm" | "elevated" | "fragile";
  };
  explanation: string;
  sources: string[];
  errors: string[];
};

const monthIndex: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

export function parseDeribitOptionSummaries(payload: unknown, receivedAt = Date.now()): OptionIvQuote[] {
  if (!isRecord(payload) || !Array.isArray(payload.result)) return [];
  return payload.result
    .map((row) => parseOptionSummaryRow(row, receivedAt))
    .filter((quote): quote is OptionIvQuote => Boolean(quote));
}

export function parseDeribitIndexPrice(payload: unknown): number {
  if (!isRecord(payload) || !isRecord(payload.result)) return 0;
  const price = numberValue(payload.result.index_price);
  return isFinitePositive(price) ? price : 0;
}

export function buildOptionsIvOracle(input: {
  quotes: OptionIvQuote[];
  indexPriceUsd: number;
  generatedAt?: number;
  errors?: string[];
}): OptionsIvOracle {
  const generatedAt = input.generatedAt ?? Date.now();
  const indexPriceUsd = isFinitePositive(input.indexPriceUsd)
    ? input.indexPriceUsd
    : median(input.quotes.map((quote) => quote.estimatedDeliveryPriceUsd).filter(isFinitePositive));
  const validQuotes = input.quotes.filter(
    (quote) =>
      isFinitePositive(quote.markIvPct) &&
      isFinitePositive(quote.strikeUsd) &&
      quote.expiryTimestamp > generatedAt &&
      isFinitePositive(indexPriceUsd),
  );
  const enriched = validQuotes.map((quote): SelectedOptionIvQuote => {
    const moneynessPct = ((quote.strikeUsd - indexPriceUsd) / indexPriceUsd) * 100;
    const timeToExpiryDays = (quote.expiryTimestamp - generatedAt) / 86_400_000;
    const spreadPenalty =
      isFinitePositive(quote.bidPriceBtc ?? 0) && isFinitePositive(quote.askPriceBtc ?? 0)
        ? Math.min(30, (((quote.askPriceBtc ?? 0) - (quote.bidPriceBtc ?? 0)) / Math.max(quote.markPriceBtc ?? quote.askPriceBtc ?? 1, 0.000001)) * 100)
        : 18;
    const liquidityScore = Math.max(
      0,
      Math.min(100, Math.log10(1 + (quote.openInterestBtc ?? 0)) * 24 + Math.log10(1 + (quote.volumeUsd ?? 0)) * 7 - spreadPenalty),
    );
    return {
      ...quote,
      moneynessPct,
      timeToExpiryDays,
      liquidityScore,
    };
  });
  const selected = enriched
    .filter((quote) => Math.abs(quote.moneynessPct) <= 7.5 && quote.timeToExpiryDays <= 45)
    .sort((a, b) => b.liquidityScore - a.liquidityScore || Math.abs(a.moneynessPct) - Math.abs(b.moneynessPct))
    .slice(0, 12);
  const ivSource = selected.length > 0 ? selected : enriched.slice(0, 12);
  const atmIvPct = round(median(ivSource.map((quote) => quote.markIvPct)), 2);
  const ivDecimal = atmIvPct / 100;
  const expectedMove1hUsd = indexPriceUsd * ivDecimal * Math.sqrt((1 / 24) / 365);
  const expectedMove1dUsd = indexPriceUsd * ivDecimal * Math.sqrt(1 / 365);
  const expectedMove1hBps = (expectedMove1hUsd / Math.max(indexPriceUsd, 1)) * 10_000;
  const expectedMove1dBps = (expectedMove1dUsd / Math.max(indexPriceUsd, 1)) * 10_000;
  const averageLiquidity = average(ivSource.map((quote) => quote.liquidityScore));
  const liquidityState = averageLiquidity >= 45 && ivSource.length >= 4 ? "liquid" : averageLiquidity >= 20 && ivSource.length >= 2 ? "mixed" : "thin";
  const executionHaircutBps = round(expectedMove1hBps * 0.12 + (liquidityState === "thin" ? 8 : liquidityState === "mixed" ? 3 : 0), 2);
  const regime =
    liquidityState === "thin" || atmIvPct >= 75
      ? "fragile"
      : atmIvPct >= 30 || expectedMove1dBps >= 150
        ? "elevated"
        : "calm";

  return {
    generatedAt,
    indexPriceUsd,
    selected: ivSource,
    termBuckets: buildTermBuckets(enriched, generatedAt),
    summary: {
      sourceCount: validQuotes.length,
      selectedCount: ivSource.length,
      atmIvPct,
      expectedMove1hUsd: round(expectedMove1hUsd),
      expectedMove1hBps: round(expectedMove1hBps, 2),
      expectedMove1dUsd: round(expectedMove1dUsd),
      expectedMove1dBps: round(expectedMove1dBps, 2),
      executionHaircutBps,
      liquidityState,
      regime,
    },
    explanation:
      "atm_iv = median(liquid near-ATM Deribit BTC options); expected_move_bps = IV * sqrt(horizon_years) * 10000; execution_haircut_bps = 12% of 1h expected move plus liquidity penalty",
    sources: uniqueStrings(validQuotes.map((quote) => quote.source)),
    errors: input.errors ?? [],
  };
}

function parseOptionSummaryRow(row: unknown, receivedAt: number): OptionIvQuote | undefined {
  if (!isRecord(row)) return undefined;
  const instrumentName = String(row.instrument_name ?? "");
  if (!instrumentName.startsWith("BTC-")) return undefined;
  const parsed = parseInstrumentName(instrumentName);
  if (!parsed) return undefined;
  const markIvPct = numberValue(row.mark_iv);
  const underlyingPriceUsd = numberValue(row.underlying_price);
  const estimatedDeliveryPriceUsd = numberValue(row.estimated_delivery_price);
  if (!isFinitePositive(markIvPct)) return undefined;
  return {
    instrumentName,
    optionType: parsed.optionType,
    strikeUsd: parsed.strikeUsd,
    expiryTimestamp: parsed.expiryTimestamp,
    markIvPct,
    underlyingPriceUsd: isFinitePositive(underlyingPriceUsd) ? underlyingPriceUsd : estimatedDeliveryPriceUsd,
    estimatedDeliveryPriceUsd: isFinitePositive(estimatedDeliveryPriceUsd) ? estimatedDeliveryPriceUsd : underlyingPriceUsd,
    bidPriceBtc: finitePositiveOrUndefined(numberValue(row.bid_price)),
    askPriceBtc: finitePositiveOrUndefined(numberValue(row.ask_price)),
    markPriceBtc: finitePositiveOrUndefined(numberValue(row.mark_price)),
    openInterestBtc: finitePositiveOrUndefined(numberValue(row.open_interest)),
    volumeUsd: finitePositiveOrUndefined(numberValue(row.volume_usd)),
    receivedAt,
    source: "https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option",
  };
}

function parseInstrumentName(instrumentName: string): { expiryTimestamp: number; strikeUsd: number; optionType: OptionType } | undefined {
  const match = /^BTC-(\d{1,2})([A-Z]{3})(\d{2})-(\d+(?:\.\d+)?)-([CP])$/.exec(instrumentName);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = monthIndex[match[2] ?? ""];
  const year = 2000 + Number(match[3]);
  const strikeUsd = Number(match[4]);
  if (!Number.isInteger(day) || month === undefined || !isFinitePositive(strikeUsd)) return undefined;
  return {
    expiryTimestamp: Date.UTC(year, month, day, 8, 0, 0),
    strikeUsd,
    optionType: match[5] === "C" ? "call" : "put",
  };
}

function buildTermBuckets(quotes: SelectedOptionIvQuote[], generatedAt: number): OptionsIvOracle["termBuckets"] {
  const groups = new Map<number, SelectedOptionIvQuote[]>();
  for (const quote of quotes) {
    const group = groups.get(quote.expiryTimestamp) ?? [];
    group.push(quote);
    groups.set(quote.expiryTimestamp, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .slice(0, 6)
    .map(([expiryTimestamp, group]) => ({
      expiry: new Date(expiryTimestamp).toISOString().slice(0, 10),
      daysToExpiry: round((expiryTimestamp - generatedAt) / 86_400_000, 2),
      quoteCount: group.length,
      medianIvPct: round(median(group.map((quote) => quote.markIvPct)), 2),
      openInterestBtc: round(group.reduce((sum, quote) => sum + (quote.openInterestBtc ?? 0), 0), 2),
      volumeUsd: round(group.reduce((sum, quote) => sum + (quote.volumeUsd ?? 0), 0), 2),
    }));
}

function median(values: number[]): number {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (clean.length === 0) return 0;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 === 0
    ? ((clean[middle - 1] ?? 0) + (clean[middle] ?? 0)) / 2
    : clean[middle] ?? 0;
}

function average(values: number[]): number {
  const clean = values.filter(Number.isFinite);
  return clean.length > 0 ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
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

function finitePositiveOrUndefined(value: number): number | undefined {
  return isFinitePositive(value) ? value : undefined;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type UsdtBasisTicker = {
  venue: string;
  label: string;
  pair: string;
  priceUsd: number;
  bidUsd?: number;
  askUsd?: number;
  volumeUsd?: number;
  receivedAt: number;
  source: string;
  exchangeTimestamp?: number;
};

export type UsdtBasisVenue = UsdtBasisTicker & {
  basisBps: number;
  premiumToMedianBps: number;
  spreadBps: number;
  ageMs: number;
  state: "normal" | "watch" | "depeg" | "stale";
};

export type UsdtBasisOracle = {
  generatedAt: number;
  medianUsdtUsd: number;
  basisBps: number;
  dispersionBps: number;
  venues: UsdtBasisVenue[];
  summary: {
    sourceCount: number;
    normalCount: number;
    watchCount: number;
    depegCount: number;
    staleCount: number;
    dynamicHaircutBps: number;
    policy: "cross-lane-ok" | "haircut-required" | "cross-lane-halt";
    confidence: "high" | "medium" | "low";
  };
  explanation: string;
  sources: string[];
  errors: string[];
};

export function parseCoinbaseUsdtTicker(payload: unknown, receivedAt = Date.now()): UsdtBasisTicker | undefined {
  if (!isRecord(payload)) return undefined;
  const price = numberValue(payload.price);
  if (!isFinitePositive(price)) return undefined;
  const bid = numberValue(payload.bid);
  const ask = numberValue(payload.ask);
  const volume = numberValue(payload.volume);
  return {
    venue: "coinbase",
    label: "Coinbase",
    pair: "USDT-USD",
    priceUsd: price,
    bidUsd: isFinitePositive(bid) ? bid : undefined,
    askUsd: isFinitePositive(ask) ? ask : undefined,
    volumeUsd: isFinitePositive(volume) ? volume * price : undefined,
    receivedAt,
    source: "https://api.exchange.coinbase.com/products/USDT-USD/ticker",
    exchangeTimestamp: typeof payload.time === "string" ? Date.parse(payload.time) : undefined,
  };
}

export function parseKrakenUsdtTicker(payload: unknown, receivedAt = Date.now()): UsdtBasisTicker | undefined {
  if (!isRecord(payload) || !isRecord(payload.result)) return undefined;
  const ticker = Object.values(payload.result).find(isRecord);
  if (!ticker || !Array.isArray(ticker.c)) return undefined;
  const price = numberValue(ticker.c[0]);
  if (!isFinitePositive(price)) return undefined;
  const bid = Array.isArray(ticker.b) ? numberValue(ticker.b[0]) : Number.NaN;
  const ask = Array.isArray(ticker.a) ? numberValue(ticker.a[0]) : Number.NaN;
  const volume = Array.isArray(ticker.v) ? numberValue(ticker.v[1] ?? ticker.v[0]) : Number.NaN;
  return {
    venue: "kraken",
    label: "Kraken",
    pair: "USDTUSD",
    priceUsd: price,
    bidUsd: isFinitePositive(bid) ? bid : undefined,
    askUsd: isFinitePositive(ask) ? ask : undefined,
    volumeUsd: isFinitePositive(volume) ? volume * price : undefined,
    receivedAt,
    source: "https://api.kraken.com/0/public/Ticker?pair=USDTUSD",
  };
}

export function parseBitstampUsdtTicker(payload: unknown, receivedAt = Date.now()): UsdtBasisTicker | undefined {
  if (!isRecord(payload)) return undefined;
  const price = numberValue(payload.last);
  if (!isFinitePositive(price)) return undefined;
  const bid = numberValue(payload.bid);
  const ask = numberValue(payload.ask);
  const volume = numberValue(payload.volume);
  const timestamp = numberValue(payload.timestamp);
  return {
    venue: "bitstamp",
    label: "Bitstamp",
    pair: "usdtusd",
    priceUsd: price,
    bidUsd: isFinitePositive(bid) ? bid : undefined,
    askUsd: isFinitePositive(ask) ? ask : undefined,
    volumeUsd: isFinitePositive(volume) ? volume * price : undefined,
    receivedAt,
    source: "https://www.bitstamp.net/api/v2/ticker/usdtusd/",
    exchangeTimestamp: isFinitePositive(timestamp) ? timestamp * 1_000 : undefined,
  };
}

export function parseCoinGeckoTetherPrice(payload: unknown, receivedAt = Date.now()): UsdtBasisTicker | undefined {
  if (!isRecord(payload) || !isRecord(payload.tether)) return undefined;
  const price = numberValue(payload.tether.usd);
  if (!isFinitePositive(price)) return undefined;
  const volume = numberValue(payload.tether.usd_24h_vol);
  const updatedAt = numberValue(payload.tether.last_updated_at);
  return {
    venue: "coingecko",
    label: "CoinGecko",
    pair: "tether/usd",
    priceUsd: price,
    volumeUsd: isFinitePositive(volume) ? volume : undefined,
    receivedAt,
    source: "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd&include_24hr_vol=true&include_last_updated_at=true",
    exchangeTimestamp: isFinitePositive(updatedAt) ? updatedAt * 1_000 : undefined,
  };
}

export function buildUsdtBasisOracle(input: {
  tickers: Array<UsdtBasisTicker | undefined>;
  generatedAt?: number;
  staleMs?: number;
  errors?: string[];
}): UsdtBasisOracle {
  const generatedAt = input.generatedAt ?? Date.now();
  const staleMs = input.staleMs ?? 60_000;
  const tickers = input.tickers
    .filter((ticker): ticker is UsdtBasisTicker => Boolean(ticker))
    .filter((ticker) => isFinitePositive(ticker.priceUsd));
  const freshTickers = tickers.filter((ticker) => generatedAt - (ticker.exchangeTimestamp ?? ticker.receivedAt) <= staleMs);
  const evidenceTickers = freshTickers.length >= 2 ? freshTickers : tickers;
  const prices = evidenceTickers.map((ticker) => ticker.priceUsd).sort((a, b) => a - b);
  const medianUsdtUsd = median(prices);
  const basisBps = (medianUsdtUsd - 1) * 10_000;
  const deviationsBps = evidenceTickers
    .map((ticker) => Math.abs(((ticker.priceUsd - medianUsdtUsd) / Math.max(medianUsdtUsd, 0.000001)) * 10_000))
    .sort((a, b) => a - b);
  const dispersionBps = median(deviationsBps);

  const venues = tickers
    .map((ticker): UsdtBasisVenue => {
      const basis = (ticker.priceUsd - 1) * 10_000;
      const premiumToMedianBps = medianUsdtUsd > 0 ? ((ticker.priceUsd - medianUsdtUsd) / medianUsdtUsd) * 10_000 : 0;
      const spreadBps =
        isFinitePositive(ticker.bidUsd ?? 0) && isFinitePositive(ticker.askUsd ?? 0)
          ? (((ticker.askUsd ?? 0) - (ticker.bidUsd ?? 0)) / ticker.priceUsd) * 10_000
          : 0;
      const ageMs = Math.max(0, generatedAt - (ticker.exchangeTimestamp ?? ticker.receivedAt));
      const state =
        ageMs > staleMs
          ? "stale"
          : Math.abs(basis) >= 50
            ? "depeg"
            : Math.abs(basis) >= 10 || Math.abs(premiumToMedianBps) >= 5 || spreadBps >= 3
              ? "watch"
              : "normal";
      return {
        ...ticker,
        basisBps: basis,
        premiumToMedianBps,
        spreadBps,
        ageMs,
        state,
      };
    })
    .sort((a, b) => Math.abs(b.basisBps) - Math.abs(a.basisBps));

  const staleCount = venues.filter((venue) => venue.state === "stale").length;
  const depegCount = venues.filter((venue) => venue.state === "depeg").length;
  const watchCount = venues.filter((venue) => venue.state === "watch").length;
  const normalCount = venues.filter((venue) => venue.state === "normal").length;
  const maxSpreadBps = venues.reduce((max, venue) => Math.max(max, Math.max(0, venue.spreadBps)), 0);
  const dynamicHaircutBps = round(
    Math.max(3, Math.abs(basisBps) + dispersionBps * 1.5 + maxSpreadBps + staleCount * 2 + depegCount * 12),
    2,
  );
  const policy =
    depegCount > 0 || Math.abs(basisBps) >= 40
      ? "cross-lane-halt"
      : dynamicHaircutBps >= 7 || watchCount > 0 || staleCount > 0
        ? "haircut-required"
        : "cross-lane-ok";
  const confidence =
    tickers.length >= 4 && staleCount === 0 && depegCount === 0
      ? "high"
      : tickers.length >= 3 && depegCount === 0
        ? "medium"
        : "low";

  return {
    generatedAt,
    medianUsdtUsd,
    basisBps,
    dispersionBps,
    venues,
    summary: {
      sourceCount: tickers.length,
      normalCount,
      watchCount,
      depegCount,
      staleCount,
      dynamicHaircutBps,
      policy,
      confidence,
    },
    explanation:
      "median_usdt_usd = median(public USDT/USD sources); basis_bps = (median_usdt_usd - 1) * 10000; haircut_bps = max(3, abs(basis_bps) + 1.5 * MAD_bps + max_spread_bps + stale_penalty + depeg_penalty)",
    sources: uniqueStrings(tickers.map((ticker) => ticker.source)),
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

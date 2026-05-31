import type { EngineConfig, ExchangeId, WalletState } from "./types";

export const defaultEnabledExchanges: ExchangeId[] = [
  "kraken",
  "coinbase",
  "gemini",
  "binance",
  "bybit",
  "gate",
  "okx",
  "bitfinex",
  "bitstamp",
  "kucoin",
  "bitget",
];

export const defaultEngineConfig: EngineConfig = {
  maxTradeBtc: 0.75,
  minNetProfitUsd: 3,
  staleBookMs: 2_500,
  maxLatencyMs: 900,
  latencyVolatilityBpsPerSecond: 8,
  withdrawalFeeBtc: 0.00008,
  usdtUsdHaircutBps: 12,
  feesBps: {
    kraken: 26,
    coinbase: 60,
    gemini: 40,
    binance: 10,
    bybit: 10,
    gate: 20,
    okx: 10,
    bitfinex: 20,
    bitstamp: 40,
    kucoin: 10,
    bitget: 10,
  },
};

export const defaultWallets: WalletState = {
  kraken: { BTC: 0.75, USD: 125_000, USDT: 0 },
  coinbase: { BTC: 1.25, USD: 125_000, USDT: 0 },
  gemini: { BTC: 1, USD: 125_000, USDT: 0 },
  binance: { BTC: 1.5, USD: 0, USDT: 125_000 },
  bybit: { BTC: 1.5, USD: 0, USDT: 125_000 },
  gate: { BTC: 1.5, USD: 0, USDT: 125_000 },
  okx: { BTC: 1.5, USD: 0, USDT: 125_000 },
  bitfinex: { BTC: 1.25, USD: 125_000, USDT: 0 },
  bitstamp: { BTC: 1, USD: 125_000, USDT: 0 },
  kucoin: { BTC: 1.5, USD: 0, USDT: 125_000 },
  bitget: { BTC: 1.5, USD: 0, USDT: 125_000 },
};

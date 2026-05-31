export type ExchangeId =
  | "kraken"
  | "coinbase"
  | "gemini"
  | "binance"
  | "bybit"
  | "gate"
  | "okx"
  | "bitfinex"
  | "bitstamp"
  | "kucoin"
  | "bitget";

export type QuoteAsset = "USD" | "USDT";

export type OrderBookLevel = {
  price: number;
  size: number;
};

export type OrderBookSnapshot = {
  exchangeId: string;
  symbol: string;
  baseAsset: "BTC";
  quoteAsset: QuoteAsset;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  exchangeTimestamp?: number;
  receivedAt: number;
  sequence?: number;
};

export type BookDelta = {
  kind: "snapshot" | "delta" | "ticker";
  exchangeId: ExchangeId;
  symbol: string;
  baseAsset: "BTC";
  quoteAsset: QuoteAsset;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  exchangeTimestamp?: number;
  receivedAt: number;
  sequence?: number;
};

export type FeedHealth = {
  exchangeId: ExchangeId;
  status: "connecting" | "live" | "stale" | "error";
  latencyMs: number;
  lastMessageAt?: number;
  message?: string;
  rawMessageCount?: number;
  normalizedMessageCount?: number;
  rejectedMessageCount?: number;
  reconnectCount?: number;
  messagesPerSecond?: number;
  lastRawMessageAt?: number;
  lastNormalizedAt?: number;
  lastRejectReason?: string;
  snapshotFallback?: "none" | "pending" | "loaded" | "failed";
  closeCode?: number;
  closeReason?: string;
  lastPayloadShape?: string;
  transport?: "websocket" | "rest-fallback" | "replay";
  fallbackSource?: string;
  lastStateTransitionAt?: number;
};

export type WalletBalance = {
  BTC: number;
  USD: number;
  USDT: number;
};

export type WalletState = Record<string, WalletBalance>;

export type EngineConfig = {
  maxTradeBtc: number;
  minNetProfitUsd: number;
  staleBookMs: number;
  maxLatencyMs: number;
  latencyVolatilityBpsPerSecond: number;
  withdrawalFeeBtc: number;
  usdtUsdHaircutBps: number;
  feesBps: Record<string, number>;
};

export type FillLevel = {
  price: number;
  requestedBtc: number;
  filledBtc: number;
  notional: number;
};

export type SimulatedFill = {
  filledBtc: number;
  notional: number;
  vwap: number;
  complete: boolean;
  levelsUsed: FillLevel[];
};

export type RiskBreakdown = {
  score: number;
  latencyPenaltyUsd: number;
  feeCostUsd: number;
  withdrawalCostUsd: number;
  grossProfitUsd: number;
  positivePnlProbability: number;
  reasons: string[];
};

export type BookMicrostructure = {
  midPrice: number;
  spreadUsd: number;
  spreadBps: number;
  imbalance: number;
  depthImbalance?: number;
  microprice: number;
  micropriceDriftBps?: number;
  queuePressureBtc?: number;
  liquidityCliffRatio?: number;
  pressure: "bid" | "ask" | "neutral";
};

export type ImpactPoint = {
  sizeBtc: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  buyVwap: number;
  sellVwap: number;
  accepted: boolean;
};

export type OpportunityDecision = {
  id: string;
  status: "accepted" | "rejected";
  buyExchange: string;
  sellExchange: string;
  quoteAsset: QuoteAsset;
  observedAt: number;
  tradeSizeBtc: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  buyFill: SimulatedFill;
  sellFill: SimulatedFill;
  impactCurve: ImpactPoint[];
  microstructure: {
    buy: BookMicrostructure;
    sell: BookMicrostructure;
  };
  rejectionReasons: string[];
  risk: RiskBreakdown;
  explanation: string;
};

export type TradeEvent = {
  id: string;
  executedAt: number;
  decision: OpportunityDecision;
  wallets: WalletState;
  cumulativePnlUsd: number;
};

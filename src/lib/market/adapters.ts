import type { BookDelta, ExchangeId, OrderBookLevel, QuoteAsset } from "./types";

type UnknownRecord = Record<string, unknown>;

export type ExchangeAdapterConfig = {
  exchangeId: ExchangeId;
  lane: QuoteAsset;
  label: string;
  websocketUrl: string;
  subscribeMessage?: unknown;
  restSnapshotUrl?: string;
  tokenUrl?: string;
  docsUrl: string;
  sourceYield?: string[];
};

export const exchangeAdapters: ExchangeAdapterConfig[] = [
  {
    exchangeId: "kraken",
    lane: "USD",
    label: "Kraken BTC/USD",
    websocketUrl: "wss://ws.kraken.com/v2",
    subscribeMessage: {
      method: "subscribe",
      params: { channel: "book", symbol: ["BTC/USD"], depth: 25, snapshot: true },
    },
    docsUrl: "https://docs.kraken.com/api/docs/websocket-v2/book/",
  },
  {
    exchangeId: "coinbase",
    lane: "USD",
    label: "Coinbase BTC-USD",
    websocketUrl: "wss://ws-feed.exchange.coinbase.com",
    subscribeMessage: {
      type: "subscribe",
      product_ids: ["BTC-USD"],
      channels: ["level2_batch"],
    },
    restSnapshotUrl: "/api/snapshots/coinbase",
    docsUrl: "https://docs.cdp.coinbase.com/exchange/websocket-feed/channels",
    sourceYield: ["L2 snapshot", "L2 deltas", "REST fallback", "REST trade tape", "close diagnostics"],
  },
  {
    exchangeId: "gemini",
    lane: "USD",
    label: "Gemini BTC/USD",
    websocketUrl: "wss://ws.gemini.com?snapshot=20",
    subscribeMessage: {
      id: "gemini-btcusd",
      method: "SUBSCRIBE",
      params: ["btcusd@depth20@100ms", "btcusd@bookTicker"],
    },
    restSnapshotUrl: "/api/snapshots/gemini",
    docsUrl: "https://docs.gemini.com/websocket/streams",
    sourceYield: ["L2 depth20", "book ticker", "REST trade tape", "REST fallback", "close diagnostics"],
  },
  {
    exchangeId: "binance",
    lane: "USDT",
    label: "Binance BTC/USDT",
    websocketUrl: "wss://stream.binance.com:9443/ws/btcusdt@depth@100ms",
    restSnapshotUrl: "/api/snapshots/binance",
    docsUrl: "https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams",
    sourceYield: ["L2 deltas", "REST snapshot bootstrap", "ping/pong transport", "close diagnostics"],
  },
  {
    exchangeId: "bybit",
    lane: "USDT",
    label: "Bybit BTC/USDT",
    websocketUrl: "wss://stream.bybit.com/v5/public/spot",
    subscribeMessage: {
      op: "subscribe",
      args: ["orderbook.50.BTCUSDT"],
    },
    docsUrl: "https://bybit-exchange.github.io/docs/v5/websocket/public/orderbook",
  },
  {
    exchangeId: "gate",
    lane: "USDT",
    label: "Gate.io BTC/USDT",
    websocketUrl: "wss://api.gateio.ws/ws/v4/",
    subscribeMessage: {
      time: 0,
      channel: "spot.order_book",
      event: "subscribe",
      payload: ["BTC_USDT", "20", "100ms"],
    },
    docsUrl: "https://www.gate.com/docs/developers/apiv4/ws/en/",
  },
  {
    exchangeId: "okx",
    lane: "USDT",
    label: "OKX BTC/USDT",
    websocketUrl: "wss://ws.okx.com:8443/ws/v5/public",
    subscribeMessage: {
      op: "subscribe",
      args: [{ channel: "books5", instId: "BTC-USDT" }],
    },
    docsUrl: "https://app.okx.com/docs-v5/trick_en/",
  },
  {
    exchangeId: "bitfinex",
    lane: "USD",
    label: "Bitfinex BTC/USD",
    websocketUrl: "wss://api-pub.bitfinex.com/ws/2",
    subscribeMessage: {
      event: "subscribe",
      channel: "book",
      symbol: "tBTCUSD",
      prec: "P0",
      freq: "F0",
      len: 25,
    },
    docsUrl: "https://docs.bitfinex.com/docs/ws-general",
  },
  {
    exchangeId: "bitstamp",
    lane: "USD",
    label: "Bitstamp BTC/USD",
    websocketUrl: "wss://ws.bitstamp.net",
    subscribeMessage: {
      event: "bts:subscribe",
      data: { channel: "order_book_btcusd" },
    },
    restSnapshotUrl: "/api/snapshots/bitstamp",
    docsUrl: "https://www.bitstamp.net/api/",
    sourceYield: ["L2 snapshots", "REST fallback", "timestamp audit"],
  },
  {
    exchangeId: "kucoin",
    lane: "USDT",
    label: "KuCoin BTC/USDT",
    websocketUrl: "wss://ws-api-spot.kucoin.com/",
    tokenUrl: "/api/kucoin-bullet-public",
    subscribeMessage: {
      type: "subscribe",
      topic: "/spotMarket/level2Depth50:BTC-USDT",
      privateChannel: false,
      response: true,
    },
    restSnapshotUrl: "/api/snapshots/kucoin",
    docsUrl: "https://www.kucoin.com/docs-new/websocket-api/base-info/get-public-token-spot-margin",
    sourceYield: ["public bullet token", "L2 depth50", "sequence audit", "REST liquidity radar"],
  },
  {
    exchangeId: "bitget",
    lane: "USDT",
    label: "Bitget BTC/USDT",
    websocketUrl: "wss://ws.bitget.com/v3/ws/public",
    subscribeMessage: {
      op: "subscribe",
      args: [{ instType: "spot", topic: "books50", symbol: "BTCUSDT" }],
    },
    docsUrl: "https://www.bitget.com/api-doc/uta/websocket/public/Order-Book-Channel",
    sourceYield: ["L2 books50", "sequence audit", "20ms depth cadence", "close diagnostics"],
  },
];

export function normalizeExchangeMessage(exchangeId: ExchangeId, payload: unknown): BookDelta[] {
  const receivedAt = Date.now();
  switch (exchangeId) {
    case "kraken":
      if (!isRecord(payload)) return [];
      return normalizeKraken(payload, receivedAt);
    case "coinbase":
      if (!isRecord(payload)) return [];
      return normalizeCoinbase(payload, receivedAt);
    case "gemini":
      if (!isRecord(payload)) return [];
      return normalizeGemini(payload, receivedAt);
    case "binance":
      if (!isRecord(payload)) return [];
      return normalizeBinance(payload, receivedAt);
    case "bybit":
      if (!isRecord(payload)) return [];
      return normalizeBybit(payload, receivedAt);
    case "gate":
      if (!isRecord(payload)) return [];
      return normalizeGate(payload, receivedAt);
    case "okx":
      if (!isRecord(payload)) return [];
      return normalizeOkx(payload, receivedAt);
    case "bitfinex":
      return normalizeBitfinex(payload, receivedAt);
    case "bitstamp":
      if (!isRecord(payload)) return [];
      return normalizeBitstamp(payload, receivedAt);
    case "kucoin":
      if (!isRecord(payload)) return [];
      return normalizeKuCoin(payload, receivedAt);
    case "bitget":
      if (!isRecord(payload)) return [];
      return normalizeBitget(payload, receivedAt);
    default:
      return [];
  }
}

function normalizeKraken(payload: UnknownRecord, receivedAt: number): BookDelta[] {
  if (payload.channel !== "book" || !Array.isArray(payload.data)) return [];
  return payload.data.filter(isRecord).map((entry) => ({
    kind: payload.type === "update" ? "delta" : "snapshot",
    exchangeId: "kraken",
    symbol: "BTC/USD",
    baseAsset: "BTC",
    quoteAsset: "USD",
    bids: levelsFromObjects(entry.bids),
    asks: levelsFromObjects(entry.asks),
    exchangeTimestamp: parseTime(entry.timestamp),
    receivedAt,
    sequence: numeric(entry.checksum),
  }));
}

function normalizeCoinbase(payload: UnknownRecord, receivedAt: number): BookDelta[] {
  const productId = String(payload.product_id ?? "BTC-USD");
  if (!productId.includes("BTC-USD")) return [];

  if (payload.type === "snapshot") {
    return [
      {
        kind: "snapshot",
        exchangeId: "coinbase",
        symbol: "BTC-USD",
        baseAsset: "BTC",
        quoteAsset: "USD",
        bids: levelsFromTuples(payload.bids),
        asks: levelsFromTuples(payload.asks),
        receivedAt,
      },
    ];
  }

  if (payload.type === "l2update" && Array.isArray(payload.changes)) {
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    for (const change of payload.changes) {
      if (!Array.isArray(change)) continue;
      const [side, price, size] = change;
      const level = parseLevel(price, size);
      if (!level) continue;
      if (side === "buy") bids.push(level);
      if (side === "sell") asks.push(level);
    }
    return [
      {
        kind: "delta",
        exchangeId: "coinbase",
        symbol: "BTC-USD",
        baseAsset: "BTC",
        quoteAsset: "USD",
        bids,
        asks,
        exchangeTimestamp: parseTime(payload.time),
        receivedAt,
      },
    ];
  }

  return [];
}

function normalizeGemini(payload: UnknownRecord, receivedAt: number): BookDelta[] {
  if (Array.isArray(payload.events)) {
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    for (const event of payload.events) {
      if (!isRecord(event)) continue;
      const level = parseLevel(event.price, event.remaining);
      if (!level) continue;
      if (event.side === "bid") bids.push(level);
      if (event.side === "ask") asks.push(level);
    }
    return [
      {
        kind: payload.type === "update" ? "delta" : "snapshot",
        exchangeId: "gemini",
        symbol: "BTC/USD",
        baseAsset: "BTC",
        quoteAsset: "USD",
        bids,
        asks,
        exchangeTimestamp: numeric(payload.timestampms),
        receivedAt,
        sequence: numeric(payload.socket_sequence),
      },
    ];
  }

  if (Array.isArray(payload.bids) || Array.isArray(payload.asks)) {
    return [
      {
        kind: "snapshot",
        exchangeId: "gemini",
        symbol: "BTC/USD",
        baseAsset: "BTC",
        quoteAsset: "USD",
        bids: levelsFromTuples(payload.bids).concat(levelsFromObjectsWithSizeKey(payload.bids, "amount")),
        asks: levelsFromTuples(payload.asks).concat(levelsFromObjectsWithSizeKey(payload.asks, "amount")),
        receivedAt,
        sequence: numeric(payload.lastUpdateId),
      },
    ];
  }

  if (payload.s === "btcusd" && (payload.b || payload.a)) {
    const bid = parseLevel(payload.b, payload.B);
    const ask = parseLevel(payload.a, payload.A);
    return [
      {
        kind: "ticker",
        exchangeId: "gemini",
        symbol: "BTC/USD",
        baseAsset: "BTC",
        quoteAsset: "USD",
        bids: bid ? [bid] : [],
        asks: ask ? [ask] : [],
        exchangeTimestamp: normalizeMaybeNanoseconds(payload.E),
        receivedAt,
        sequence: numeric(payload.u),
      },
    ];
  }

  return [];
}

function normalizeBinance(payload: UnknownRecord, receivedAt: number): BookDelta[] {
  const bidsPayload = payload.bids ?? payload.b;
  const asksPayload = payload.asks ?? payload.a;
  if (!Array.isArray(bidsPayload) && !Array.isArray(asksPayload)) return [];
  return [
    {
      kind: payload.e === "depthUpdate" ? "delta" : "snapshot",
      exchangeId: "binance",
      symbol: "BTC/USDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: levelsFromTuples(bidsPayload),
      asks: levelsFromTuples(asksPayload),
      exchangeTimestamp: numeric(payload.E),
      receivedAt,
      sequence: numeric(payload.u ?? payload.lastUpdateId),
    },
  ];
}

function normalizeBybit(payload: UnknownRecord, receivedAt: number): BookDelta[] {
  if (!String(payload.topic ?? "").includes("BTCUSDT") || !isRecord(payload.data)) return [];
  return [
    {
      kind: payload.type === "delta" ? "delta" : "snapshot",
      exchangeId: "bybit",
      symbol: "BTC/USDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: levelsFromTuples(payload.data.b),
      asks: levelsFromTuples(payload.data.a),
      exchangeTimestamp: numeric(payload.cts ?? payload.ts),
      receivedAt,
      sequence: numeric(payload.data.u),
    },
  ];
}

function normalizeGate(payload: UnknownRecord, receivedAt: number): BookDelta[] {
  if (payload.channel !== "spot.order_book" || !isRecord(payload.result)) return [];
  return [
    {
      kind: "snapshot",
      exchangeId: "gate",
      symbol: "BTC/USDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: levelsFromTuples(payload.result.bids),
      asks: levelsFromTuples(payload.result.asks),
      exchangeTimestamp: numeric(payload.result.t),
      receivedAt,
      sequence: numeric(payload.result.id),
    },
  ];
}

function normalizeOkx(payload: UnknownRecord, receivedAt: number): BookDelta[] {
  const arg = isRecord(payload.arg) ? payload.arg : undefined;
  if (arg?.instId !== "BTC-USDT" || !Array.isArray(payload.data)) return [];
  return payload.data.filter(isRecord).map((entry) => ({
    kind: String(arg.channel ?? "").includes("books") ? "snapshot" : "delta",
    exchangeId: "okx",
    symbol: "BTC/USDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    bids: levelsFromTuples(entry.bids),
    asks: levelsFromTuples(entry.asks),
    exchangeTimestamp: numeric(entry.ts),
    receivedAt,
    sequence: numeric(entry.seqId),
  }));
}

function normalizeBitfinex(payload: unknown, receivedAt: number): BookDelta[] {
  if (!Array.isArray(payload) || payload.length < 2 || payload[1] === "hb") return [];
  const [, data] = payload;

  if (Array.isArray(data) && Array.isArray(data[0])) {
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    for (const tuple of data) {
      const level = bitfinexLevel(tuple);
      if (!level) continue;
      if (level.side === "bid") bids.push(level.level);
      if (level.side === "ask") asks.push(level.level);
    }
    return [
      {
        kind: "snapshot",
        exchangeId: "bitfinex",
        symbol: "BTC/USD",
        baseAsset: "BTC",
        quoteAsset: "USD",
        bids,
        asks,
        receivedAt,
      },
    ];
  }

  const level = bitfinexLevel(data);
  if (!level) return [];
  return [
    {
      kind: "delta",
      exchangeId: "bitfinex",
      symbol: "BTC/USD",
      baseAsset: "BTC",
      quoteAsset: "USD",
      bids: level.side === "bid" ? [level.level] : [],
      asks: level.side === "ask" ? [level.level] : [],
      receivedAt,
    },
  ];
}

function normalizeBitstamp(payload: UnknownRecord, receivedAt: number): BookDelta[] {
  const data = isRecord(payload.data) ? payload.data : payload;
  if (!Array.isArray(data.bids) && !Array.isArray(data.asks)) return [];
  return [
    {
      kind: "snapshot",
      exchangeId: "bitstamp",
      symbol: "BTC/USD",
      baseAsset: "BTC",
      quoteAsset: "USD",
      bids: levelsFromTuples(data.bids),
      asks: levelsFromTuples(data.asks),
      exchangeTimestamp: bitstampTime(data),
      receivedAt,
    },
  ];
}

function normalizeKuCoin(payload: UnknownRecord, receivedAt: number): BookDelta[] {
  const topic = String(payload.topic ?? "");
  const data = isRecord(payload.data) ? payload.data : payload;
  if (!topic.includes("BTC-USDT") && String(data.symbol ?? "") !== "BTC-USDT") return [];
  if (!Array.isArray(data.bids) && !Array.isArray(data.asks)) return [];
  return [
    {
      kind: "snapshot",
      exchangeId: "kucoin",
      symbol: "BTC/USDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      bids: levelsFromTuples(data.bids),
      asks: levelsFromTuples(data.asks),
      exchangeTimestamp: numeric(data.timestamp ?? data.time),
      receivedAt,
      sequence: numeric(data.sequenceStart ?? data.sequence ?? data.sequenceEnd),
    },
  ];
}

function normalizeBitget(payload: UnknownRecord, receivedAt: number): BookDelta[] {
  const arg = isRecord(payload.arg) ? payload.arg : undefined;
  const symbol = String(arg?.symbol ?? payload.symbol ?? "");
  if (symbol !== "BTCUSDT" || !Array.isArray(payload.data)) return [];
  return payload.data.filter(isRecord).map((entry) => ({
    kind: payload.action === "update" ? "delta" : "snapshot",
    exchangeId: "bitget",
    symbol: "BTC/USDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    bids: levelsFromTuples(entry.b ?? entry.bids),
    asks: levelsFromTuples(entry.a ?? entry.asks),
    exchangeTimestamp: numeric(entry.ts),
    receivedAt,
    sequence: numeric(entry.seq),
  }));
}

function bitfinexLevel(value: unknown): { side: "bid" | "ask"; level: OrderBookLevel } | undefined {
  if (!Array.isArray(value)) return undefined;
  const price = Number(value[0]);
  const count = Number(value[1]);
  const amount = Number(value[2]);
  if (!Number.isFinite(price) || !Number.isFinite(count) || !Number.isFinite(amount)) return undefined;
  if (count === 0) {
    return { side: amount >= 0 ? "bid" : "ask", level: { price, size: 0 } };
  }
  return { side: amount > 0 ? "bid" : "ask", level: { price, size: Math.abs(amount) } };
}

function bitstampTime(data: UnknownRecord): number | undefined {
  const microtimestamp = numeric(data.microtimestamp);
  if (microtimestamp !== undefined) return Math.floor(microtimestamp / 1_000);
  const timestamp = numeric(data.timestamp);
  return timestamp === undefined ? undefined : timestamp * 1_000;
}

function levelsFromObjects(value: unknown): OrderBookLevel[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => parseLevel(item.price, item.qty))
    .filter((item): item is OrderBookLevel => Boolean(item));
}

function levelsFromObjectsWithSizeKey(value: unknown, sizeKey: string): OrderBookLevel[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => parseLevel(item.price, item[sizeKey]))
    .filter((item): item is OrderBookLevel => Boolean(item));
}

function levelsFromTuples(value: unknown): OrderBookLevel[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!Array.isArray(item)) return undefined;
      return parseLevel(item[0], item[1]);
    })
    .filter((item): item is OrderBookLevel => Boolean(item));
}

function parseLevel(price: unknown, size: unknown): OrderBookLevel | undefined {
  const parsedPrice = Number(price);
  const parsedSize = Number(size);
  if (!Number.isFinite(parsedPrice) || !Number.isFinite(parsedSize)) return undefined;
  return { price: parsedPrice, size: parsedSize };
}

function parseTime(value: unknown): number | undefined {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return numeric(value);
}

function normalizeMaybeNanoseconds(value: unknown): number | undefined {
  const parsed = numeric(value);
  if (parsed === undefined) return undefined;
  return parsed > 10_000_000_000_000 ? Math.floor(parsed / 1_000_000) : parsed;
}

function numeric(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

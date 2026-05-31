/// <reference lib="webworker" />

import { exchangeAdapters, normalizeExchangeMessage } from "@/lib/market/adapters";
import { applyBookDelta, createEmptyBookStore, listBooks } from "@/lib/market/book-state";
import { buildEnginePublication, type EngineRouteState } from "@/lib/market/engine-state";
import { evaluateOpportunity, executeAcceptedTrade, findBestOpportunity } from "@/lib/market/execution";
import {
  createInitialFeedHealth,
  nextReconnectDelayMs,
  recordFeedClose,
  recordNormalizedFeedMessage,
  recordRawFeedMessage,
  recordReconnect,
  recordRejectedFeedPayload,
  recordStateTransition,
  withSnapshotFallback,
  type FeedTelemetry,
} from "@/lib/market/feed-health";
import type {
  EngineConfig,
  ExchangeId,
  FeedHealth,
  OpportunityDecision,
  TradeEvent,
  WalletState,
} from "@/lib/market/types";

type WorkerCommand =
  | { type: "start"; enabledExchanges: ExchangeId[]; config: EngineConfig; wallets: WalletState }
  | { type: "stop" }
  | { type: "clear" }
  | { type: "useReplay" };

export type EngineWorkerMessage =
  | {
      type: "state";
      books: ReturnType<typeof listBooks>;
      best?: OpportunityDecision;
      currentBest?: OpportunityDecision;
      latestDecision?: OpportunityDecision;
      lastTickAt: number;
      routeFreshnessMs?: number;
      routeState: EngineRouteState;
      routeMessage: string;
      recent: OpportunityDecision[];
      trades: TradeEvent[];
      wallets: WalletState;
      health: FeedHealth[];
    }
  | { type: "log"; level: "info" | "error"; message: string };

const ctx = self as DedicatedWorkerGlobalScope;
const sockets = new Map<ExchangeId, WebSocket>();
const reconnectTimers = new Map<ExchangeId, number>();
const pingTimers = new Map<ExchangeId, number>();
const health = new Map<ExchangeId, FeedTelemetry>();
const store = createEmptyBookStore();
let config: EngineConfig | undefined;
let wallets: WalletState = {};
let recent: OpportunityDecision[] = [];
let trades: TradeEvent[] = [];
let cumulativePnlUsd = 0;
let publishTimer: number | undefined;
let lastEvaluateAt = 0;
let active = false;
let activeExchanges: ExchangeId[] = [];

ctx.onmessage = (event: MessageEvent<WorkerCommand>) => {
  const command = event.data;
  if (command.type === "stop") {
    stopAll();
    return;
  }
  if (command.type === "clear") {
    stopAll();
    clearState();
    publish();
    return;
  }
  if (command.type === "useReplay") {
    seedReplay();
    return;
  }
  if (command.type === "start") {
    stopAll();
    active = true;
    activeExchanges = command.enabledExchanges;
    config = command.config;
    wallets = structuredClone(command.wallets);
    for (const exchangeId of command.enabledExchanges) void connect(exchangeId);
    publishTimer = ctx.setInterval(publish, 1_000);
  }
};

async function connect(exchangeId: ExchangeId): Promise<void> {
  const adapter = exchangeAdapters.find((item) => item.exchangeId === exchangeId);
  if (!adapter) return;
  if (!activeExchanges.includes(exchangeId)) return;

  clearReconnect(exchangeId);
  clearPing(exchangeId);
  const previous = health.get(exchangeId);
  health.set(exchangeId, previous ? recordReconnect(previous) : createInitialFeedHealth(exchangeId));
  publish();
  void loadRestSnapshot(exchangeId);

  try {
    const tokenSession = await resolveWebSocketSession(adapter);
    if (!active || !activeExchanges.includes(exchangeId)) return;
    const socket = new WebSocket(tokenSession.websocketUrl);
    sockets.set(exchangeId, socket);

    socket.onopen = () => {
      const subscribeMessage = buildSubscribeMessage(exchangeId, adapter.subscribeMessage);
      if (subscribeMessage) socket.send(JSON.stringify(subscribeMessage));
      startPing(exchangeId, socket, tokenSession.pingInterval);
      health.set(
        exchangeId,
        recordStateTransition(ensureHealth(exchangeId), "live", Date.now(), "Subscribed to public market data", {
          transport: "websocket",
          fallbackSource: adapter.restSnapshotUrl,
        }),
      );
      publish();
    };

    socket.onmessage = (message) => {
      const receivedAt = Date.now();
      let payload: unknown;
      try {
        payload = JSON.parse(String(message.data)) as unknown;
      } catch {
        const raw = recordRawFeedMessage(ensureHealth(exchangeId), receivedAt, 0);
        health.set(exchangeId, recordRejectedFeedPayload(raw, receivedAt, "Rejected malformed JSON payload"));
        publish();
        return;
      }
      const deltas = normalizeExchangeMessage(exchangeId, payload);
      const latencyMs = Math.max(0, receivedAt - (deltas[0]?.exchangeTimestamp ?? receivedAt));
      const raw = {
        ...recordRawFeedMessage(ensureHealth(exchangeId), receivedAt, latencyMs),
        lastPayloadShape: describePayload(payload),
      };
      for (const delta of deltas) {
        applyBookDelta(store, delta);
      }
      health.set(
        exchangeId,
        deltas.length > 0
          ? {
              ...recordNormalizedFeedMessage(raw, receivedAt, deltas.length, "Receiving normalized L2 data"),
              transport: "websocket",
            }
          : recordRejectedFeedPayload(raw, receivedAt, "Waiting for order book payload"),
      );
      evaluate();
    };

    socket.onerror = () => {
      health.set(exchangeId, {
        ...ensureHealth(exchangeId),
        status: "error",
        latencyMs: 0,
        lastMessageAt: Date.now(),
        message: "WebSocket error",
      });
      publish();
    };

    socket.onclose = (event) => {
      if (!active && !health.has(exchangeId)) return;
      const current = ensureHealth(exchangeId);
      clearPing(exchangeId);
      health.set(exchangeId, recordFeedClose(current, Date.now(), event.code, event.reason || undefined));
      publish();
      scheduleReconnect(exchangeId, current.reconnectCount);
    };
  } catch (error) {
    const current = ensureHealth(exchangeId);
    health.set(exchangeId, {
      ...current,
      status: "error",
      latencyMs: 0,
      message: error instanceof Error ? error.message : "Connection failed",
    });
    scheduleReconnect(exchangeId, current.reconnectCount);
  }
}

async function loadRestSnapshot(exchangeId: ExchangeId): Promise<void> {
  const adapter = exchangeAdapters.find((item) => item.exchangeId === exchangeId);
  if (!adapter?.restSnapshotUrl) return;
  try {
    health.set(exchangeId, withSnapshotFallback(ensureHealth(exchangeId), "pending", "Loading REST depth snapshot"));
    const response = await fetch(adapter.restSnapshotUrl);
    if (!response.ok) throw new Error(`Snapshot HTTP ${response.status}`);
    const payload = (await response.json()) as unknown;
    const deltas = normalizeExchangeMessage(exchangeId, payload);
    for (const delta of deltas) applyBookDelta(store, delta);
    health.set(exchangeId, withSnapshotFallback(ensureHealth(exchangeId), "loaded", "REST depth snapshot loaded"));
    publish();
  } catch (error) {
    const current = ensureHealth(exchangeId);
    health.set(exchangeId, {
      ...withSnapshotFallback(current, "failed", error instanceof Error ? error.message : "Snapshot failed"),
      status: current.status === "live" ? "live" : "error",
      latencyMs: 0,
      lastMessageAt: Date.now(),
    });
    publish();
  }
}

function evaluate(): void {
  if (!config) return;
  const now = Date.now();
  if (now - lastEvaluateAt < 250) return;
  lastEvaluateAt = now;
  const books = listBooks(store);
  const best = findBestOpportunity(books, wallets, config);
  if (!best) {
    publish();
    return;
  }

  recent = [best, ...recent].slice(0, 50);
  if (best.status === "accepted") {
    const trade = executeAcceptedTrade(best, wallets, cumulativePnlUsd);
    wallets = trade.wallets;
    cumulativePnlUsd = trade.cumulativePnlUsd;
    trades = [trade, ...trades].slice(0, 50);
  }
  publish();
}

function publish(): void {
  const books = listBooks(store);
  const publication = buildEnginePublication({
    currentBest: config ? findBestOpportunity(books, wallets, config) : undefined,
    recent,
  });
  const message: EngineWorkerMessage = {
    type: "state",
    books,
    best: publication.best,
    currentBest: publication.currentBest,
    latestDecision: publication.latestDecision,
    lastTickAt: publication.lastTickAt,
    routeFreshnessMs: publication.routeFreshnessMs,
    routeState: publication.routeState,
    routeMessage: publication.routeMessage,
    recent,
    trades,
    wallets,
    health: Array.from(health.values()),
  };
  ctx.postMessage(message);
}

function stopAll(): void {
  active = false;
  activeExchanges = [];
  for (const timer of reconnectTimers.values()) ctx.clearTimeout(timer);
  reconnectTimers.clear();
  for (const timer of pingTimers.values()) ctx.clearInterval(timer);
  pingTimers.clear();
  for (const socket of sockets.values()) socket.close();
  sockets.clear();
  if (publishTimer) ctx.clearInterval(publishTimer);
  publishTimer = undefined;
}

function clearState(): void {
  store.books = {};
  health.clear();
  recent = [];
  trades = [];
  wallets = {};
  cumulativePnlUsd = 0;
  lastEvaluateAt = 0;
}

function ensureHealth(exchangeId: ExchangeId): FeedTelemetry {
  const current = health.get(exchangeId);
  if (current) return current;
  const initial = createInitialFeedHealth(exchangeId);
  health.set(exchangeId, initial);
  return initial;
}

function scheduleReconnect(exchangeId: ExchangeId, reconnectCount: number): void {
  if (!active || !activeExchanges.includes(exchangeId) || reconnectTimers.has(exchangeId)) return;
  const delay = nextReconnectDelayMs(reconnectCount);
  const timer = ctx.setTimeout(() => {
    reconnectTimers.delete(exchangeId);
      connect(exchangeId);
    }, delay);
  reconnectTimers.set(exchangeId, timer);
}

function clearReconnect(exchangeId: ExchangeId): void {
  const timer = reconnectTimers.get(exchangeId);
  if (timer) ctx.clearTimeout(timer);
  reconnectTimers.delete(exchangeId);
}

function clearPing(exchangeId: ExchangeId): void {
  const timer = pingTimers.get(exchangeId);
  if (timer) ctx.clearInterval(timer);
  pingTimers.delete(exchangeId);
}

function startPing(exchangeId: ExchangeId, socket: WebSocket, intervalMs?: number): void {
  clearPing(exchangeId);
  if (!intervalMs) return;
  const timer = ctx.setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ id: Date.now(), type: "ping" }));
    }
  }, Math.max(5_000, intervalMs - 1_000));
  pingTimers.set(exchangeId, timer);
}

async function resolveWebSocketSession(adapter: (typeof exchangeAdapters)[number]): Promise<{
  websocketUrl: string;
  pingInterval?: number;
}> {
  if (!adapter.tokenUrl) return { websocketUrl: adapter.websocketUrl };
  const response = await fetch(adapter.tokenUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Public token HTTP ${response.status}`);
  const payload = (await response.json()) as unknown;
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : undefined;
  const token = typeof data?.token === "string" ? data.token : undefined;
  const server = Array.isArray(data?.instanceServers) && isRecord(data.instanceServers[0])
    ? data.instanceServers[0]
    : undefined;
  const endpoint = typeof server?.endpoint === "string" ? server.endpoint : adapter.websocketUrl;
  if (!token) throw new Error("Public token missing from venue response");
  const separator = endpoint.includes("?") ? "&" : "?";
  return {
    websocketUrl: `${endpoint}${separator}token=${encodeURIComponent(token)}&connectId=${Date.now()}`,
    pingInterval: typeof server?.pingInterval === "number" ? server.pingInterval : undefined,
  };
}

function buildSubscribeMessage(exchangeId: ExchangeId, subscribeMessage: unknown): unknown {
  if (!subscribeMessage || typeof subscribeMessage !== "object") return subscribeMessage;
  if (exchangeId === "gate") return { ...(subscribeMessage as object), time: Math.floor(Date.now() / 1000) };
  if (exchangeId === "kucoin") return { id: String(Date.now()), ...(subscribeMessage as object) };
  return subscribeMessage;
}

function describePayload(payload: unknown): string {
  if (Array.isArray(payload)) return `array:${payload.length}`;
  if (!isRecord(payload)) return typeof payload;
  const keys = Object.keys(payload).slice(0, 6).join(",");
  const channel = payload.channel ?? payload.topic ?? payload.type ?? payload.event ?? payload.e;
  return channel ? `${String(channel)} keys=${keys}` : `object keys=${keys}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function seedReplay(): void {
  const now = Date.now();
  const buy = {
    exchangeId: "kraken",
    symbol: "BTC/USD",
    baseAsset: "BTC" as const,
    quoteAsset: "USD" as const,
    bids: [{ price: 69_980, size: 1.2 }],
    asks: [
      { price: 70_000, size: 0.4 },
      { price: 70_030, size: 1.2 },
    ],
    receivedAt: now,
  };
  const sell = {
    exchangeId: "coinbase",
    symbol: "BTC-USD",
    baseAsset: "BTC" as const,
    quoteAsset: "USD" as const,
    bids: [
      { price: 70_920, size: 0.35 },
      { price: 70_870, size: 1.2 },
    ],
    asks: [{ price: 70_960, size: 1 }],
    receivedAt: now,
  };
  if (!config) return;
  applyBookDelta(store, {
    kind: "snapshot",
    exchangeId: "kraken",
    symbol: buy.symbol,
    baseAsset: buy.baseAsset,
    quoteAsset: buy.quoteAsset,
    bids: buy.bids,
    asks: buy.asks,
    receivedAt: now,
    sequence: 1,
  });
  applyBookDelta(store, {
    kind: "snapshot",
    exchangeId: "coinbase",
    symbol: sell.symbol,
    baseAsset: sell.baseAsset,
    quoteAsset: sell.quoteAsset,
    bids: sell.bids,
    asks: sell.asks,
    receivedAt: now,
    sequence: 1,
  });
  health.set("kraken", {
    ...createInitialFeedHealth("kraken", now),
    status: "live",
    latencyMs: 0,
    lastMessageAt: now,
    lastNormalizedAt: now,
    normalizedMessageCount: 1,
    message: "Replay snapshot",
  });
  health.set("coinbase", {
    ...createInitialFeedHealth("coinbase", now),
    status: "live",
    latencyMs: 0,
    lastMessageAt: now,
    lastNormalizedAt: now,
    normalizedMessageCount: 1,
    message: "Replay snapshot",
  });
  const decision = evaluateOpportunity(buy, sell, wallets, config, now);
  recent = [decision, ...recent].slice(0, 50);
  if (decision.status === "accepted") {
    const trade = executeAcceptedTrade(decision, wallets, cumulativePnlUsd);
    wallets = trade.wallets;
    cumulativePnlUsd = trade.cumulativePnlUsd;
    trades = [trade, ...trades].slice(0, 50);
  }
  publish();
}

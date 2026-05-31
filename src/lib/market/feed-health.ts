import type { ExchangeId, FeedHealth } from "./types";

export type FeedTelemetry = FeedHealth & {
  connectedAt: number;
  rawMessageCount: number;
  normalizedMessageCount: number;
  rejectedMessageCount: number;
  reconnectCount: number;
  messagesPerSecond: number;
  snapshotFallback: "none" | "pending" | "loaded" | "failed";
};

export function createInitialFeedHealth(exchangeId: ExchangeId, now = Date.now()): FeedTelemetry {
  return {
    exchangeId,
    status: "connecting",
    latencyMs: 0,
    connectedAt: now,
    rawMessageCount: 0,
    normalizedMessageCount: 0,
    rejectedMessageCount: 0,
    reconnectCount: 0,
    messagesPerSecond: 0,
    snapshotFallback: "none",
    message: "Opening public WebSocket",
    transport: "websocket",
    lastStateTransitionAt: now,
  };
}

export function recordRawFeedMessage(feed: FeedTelemetry, now: number, latencyMs: number): FeedTelemetry {
  const rawMessageCount = feed.rawMessageCount + 1;
  return {
    ...feed,
    status: feed.status === "error" ? "connecting" : feed.status,
    latencyMs,
    rawMessageCount,
    lastRawMessageAt: now,
    lastMessageAt: now,
    messagesPerSecond: ratePerSecond(rawMessageCount, feed.connectedAt, now),
  };
}

export function recordStateTransition(
  feed: FeedTelemetry,
  status: FeedTelemetry["status"],
  now: number,
  message: string,
  extras: Partial<Pick<FeedTelemetry, "transport" | "fallbackSource" | "lastPayloadShape" | "snapshotFallback">> = {},
): FeedTelemetry {
  return {
    ...feed,
    ...extras,
    status,
    lastMessageAt: now,
    lastStateTransitionAt: now,
    message,
  };
}

export function recordNormalizedFeedMessage(
  feed: FeedTelemetry,
  now: number,
  deltaCount: number,
  message: string,
): FeedTelemetry {
  return {
    ...feed,
    status: "live",
    normalizedMessageCount: feed.normalizedMessageCount + deltaCount,
    lastNormalizedAt: now,
    lastMessageAt: now,
    message,
  };
}

export function recordRejectedFeedPayload(feed: FeedTelemetry, now: number, reason: string): FeedTelemetry {
  return {
    ...feed,
    rejectedMessageCount: feed.rejectedMessageCount + 1,
    lastRejectReason: reason,
    lastMessageAt: now,
    message: reason,
  };
}

export function recordFeedClose(
  feed: FeedTelemetry,
  now: number,
  closeCode?: number,
  closeReason?: string,
): FeedTelemetry {
  return {
    ...feed,
    status: "stale",
    latencyMs: 0,
    lastMessageAt: now,
    lastStateTransitionAt: now,
    closeCode,
    closeReason,
    message: closeCode ? `Socket closed (${closeCode}${closeReason ? `: ${closeReason}` : ""})` : "Socket closed",
  };
}

export function recordReconnect(feed: FeedTelemetry, now = Date.now()): FeedTelemetry {
  return {
    ...feed,
    status: "connecting",
    connectedAt: now,
    reconnectCount: feed.reconnectCount + 1,
    rawMessageCount: 0,
    messagesPerSecond: 0,
    lastStateTransitionAt: now,
    message: "Reconnecting public WebSocket",
  };
}

export function withSnapshotFallback(
  feed: FeedTelemetry,
  snapshotFallback: FeedTelemetry["snapshotFallback"],
  message = feed.message,
): FeedTelemetry {
  return {
    ...feed,
    snapshotFallback,
    message,
    transport: snapshotFallback === "loaded" ? "rest-fallback" : feed.transport,
  };
}

export function nextReconnectDelayMs(reconnectCount: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, reconnectCount));
}

function ratePerSecond(count: number, startAt: number, now: number): number {
  const elapsedSeconds = Math.max(1, (now - startAt) / 1_000);
  return count / elapsedSeconds;
}

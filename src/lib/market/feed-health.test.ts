import { describe, expect, it } from "vitest";
import {
  createInitialFeedHealth,
  nextReconnectDelayMs,
  recordNormalizedFeedMessage,
  recordRawFeedMessage,
  recordFeedClose,
  recordRejectedFeedPayload,
  recordStateTransition,
} from "./feed-health";

describe("feed health telemetry", () => {
  it("tracks raw, normalized, rejected, and reconnect counters", () => {
    const initial = createInitialFeedHealth("okx", 1_000);
    const raw = recordRawFeedMessage(initial, 1_200, 320);
    const normalized = recordNormalizedFeedMessage(raw, 1_250, 2, "Receiving normalized L2 data");
    const rejected = recordRejectedFeedPayload(normalized, 1_300, "Waiting for order book payload");

    expect(rejected).toMatchObject({
      exchangeId: "okx",
      status: "live",
      rawMessageCount: 1,
      normalizedMessageCount: 2,
      rejectedMessageCount: 1,
      lastRejectReason: "Waiting for order book payload",
    });
    expect(rejected.messagesPerSecond).toBeGreaterThan(0);
    expect(rejected.latencyMs).toBe(320);
  });

  it("caps reconnect backoff so failed venues recover without flooding", () => {
    expect(nextReconnectDelayMs(0)).toBe(1_000);
    expect(nextReconnectDelayMs(2)).toBe(4_000);
    expect(nextReconnectDelayMs(10)).toBe(30_000);
  });

  it("records close diagnostics and fallback state transitions", () => {
    const initial = createInitialFeedHealth("coinbase", 1_000);
    const live = recordStateTransition(initial, "live", 1_100, "Subscribed", {
      transport: "websocket",
      fallbackSource: "/api/snapshots/coinbase",
    });
    const closed = recordFeedClose(live, 1_300, 1006, "abnormal close");

    expect(closed).toMatchObject({
      status: "stale",
      closeCode: 1006,
      closeReason: "abnormal close",
      transport: "websocket",
      fallbackSource: "/api/snapshots/coinbase",
      lastStateTransitionAt: 1_300,
    });
  });
});

import type { OrderBookSnapshot } from "./types";

export function refreshReplayBookForEvaluation(
  book: OrderBookSnapshot,
  observedAt: number,
): OrderBookSnapshot {
  return {
    ...book,
    receivedAt: observedAt,
    exchangeTimestamp: observedAt,
  };
}

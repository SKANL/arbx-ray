import type { BookDelta, ExchangeId, OrderBookLevel, OrderBookSnapshot } from "./types";

export type BookStore = {
  books: Partial<Record<ExchangeId, OrderBookSnapshot>>;
};

export function createEmptyBookStore(): BookStore {
  return { books: {} };
}

export function applyBookDelta(store: BookStore, delta: BookDelta): OrderBookSnapshot {
  const previous = store.books[delta.exchangeId];
  const snapshot: OrderBookSnapshot =
    delta.kind === "snapshot" || !previous
      ? {
          exchangeId: delta.exchangeId,
          symbol: delta.symbol,
          baseAsset: delta.baseAsset,
          quoteAsset: delta.quoteAsset,
          bids: sortBids(delta.bids),
          asks: sortAsks(delta.asks),
          exchangeTimestamp: delta.exchangeTimestamp,
          receivedAt: delta.receivedAt,
          sequence: delta.sequence,
        }
      : {
          ...previous,
          bids: applySide(previous.bids, delta.bids, "bid"),
          asks: applySide(previous.asks, delta.asks, "ask"),
          exchangeTimestamp: delta.exchangeTimestamp ?? previous.exchangeTimestamp,
          receivedAt: delta.receivedAt,
          sequence: delta.sequence ?? previous.sequence,
        };

  store.books[delta.exchangeId] = snapshot;
  return snapshot;
}

export function listBooks(store: BookStore): OrderBookSnapshot[] {
  return Object.values(store.books).filter((book): book is OrderBookSnapshot => Boolean(book));
}

function applySide(
  previous: OrderBookLevel[],
  changes: OrderBookLevel[],
  side: "bid" | "ask",
): OrderBookLevel[] {
  const byPrice = new Map(previous.map((level) => [level.price, level.size]));
  for (const change of changes) {
    if (change.size <= 0) {
      byPrice.delete(change.price);
    } else {
      byPrice.set(change.price, change.size);
    }
  }

  const next = Array.from(byPrice, ([price, size]) => ({ price, size }));
  return side === "bid" ? sortBids(next) : sortAsks(next);
}

function sortBids(levels: OrderBookLevel[]): OrderBookLevel[] {
  return [...levels].filter(validLevel).sort((a, b) => b.price - a.price).slice(0, 100);
}

function sortAsks(levels: OrderBookLevel[]): OrderBookLevel[] {
  return [...levels].filter(validLevel).sort((a, b) => a.price - b.price).slice(0, 100);
}

function validLevel(level: OrderBookLevel): boolean {
  return Number.isFinite(level.price) && Number.isFinite(level.size) && level.price > 0;
}

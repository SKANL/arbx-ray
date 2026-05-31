"use client";

import { create } from "zustand";
import type { EngineWorkerMessage } from "@/workers/engine.worker";
import type {
  FeedHealth,
  OpportunityDecision,
  OrderBookSnapshot,
  TradeEvent,
  WalletState,
} from "@/lib/market/types";
import type { EngineRouteState } from "@/lib/market/engine-state";

type EngineMode = "idle" | "live" | "replay";

type EngineStore = {
  mode: EngineMode;
  books: OrderBookSnapshot[];
  best?: OpportunityDecision;
  currentBest?: OpportunityDecision;
  latestDecision?: OpportunityDecision;
  lastEngineTickAt?: number;
  routeFreshnessMs?: number;
  routeState: EngineRouteState;
  routeMessage: string;
  recent: OpportunityDecision[];
  trades: TradeEvent[];
  wallets: WalletState;
  health: FeedHealth[];
  setMode: (mode: EngineMode) => void;
  applyWorkerMessage: (message: EngineWorkerMessage) => void;
};

export const useEngineStore = create<EngineStore>((set) => ({
  mode: "idle",
  books: [],
  recent: [],
  trades: [],
  wallets: {},
  health: [],
  routeState: "empty",
  routeMessage: "No route yet. Start live feeds or replay to collect books.",
  setMode: (mode) => set({ mode }),
  applyWorkerMessage: (message) => {
    if (message.type !== "state") return;
    set({
      books: message.books,
      best: message.best,
      currentBest: message.currentBest,
      latestDecision: message.latestDecision,
      lastEngineTickAt: message.lastTickAt,
      routeFreshnessMs: message.routeFreshnessMs,
      routeState: message.routeState,
      routeMessage: message.routeMessage,
      recent: message.recent,
      trades: message.trades,
      wallets: message.wallets,
      health: message.health,
    });
  },
}));

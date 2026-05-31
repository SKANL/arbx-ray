"use client";

import { useEffect, useRef } from "react";
import { decisionEntry, saveJournalEntries, tradeEntry } from "@/lib/market/journal";
import { useEngineStore } from "@/store/engine-store";
import type { EngineWorkerMessage } from "@/workers/engine.worker";
import type { EngineConfig, ExchangeId, WalletState } from "@/lib/market/types";

export function useEngineWorker() {
  const workerRef = useRef<Worker | null>(null);
  const applyWorkerMessage = useEngineStore((state) => state.applyWorkerMessage);
  const setMode = useEngineStore((state) => state.setMode);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/engine.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<EngineWorkerMessage>) => {
      const message = event.data;
      applyWorkerMessage(message);
      if (message.type === "state") {
        const latestDecision = message.recent[0];
        const latestTrade = message.trades[0];
        const entries = [
          latestDecision ? decisionEntry(latestDecision) : undefined,
          latestTrade ? tradeEntry(latestTrade) : undefined,
        ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        void saveJournalEntries(entries);
      }
    };

    return () => {
      worker.postMessage({ type: "stop" });
      worker.terminate();
      workerRef.current = null;
    };
  }, [applyWorkerMessage]);

  return {
    startLive(enabledExchanges: ExchangeId[], config: EngineConfig, wallets: WalletState) {
      setMode("live");
      workerRef.current?.postMessage({ type: "start", enabledExchanges, config, wallets });
    },
    stop() {
      setMode("idle");
      workerRef.current?.postMessage({ type: "stop" });
    },
    clearSession() {
      setMode("idle");
      workerRef.current?.postMessage({ type: "clear" });
    },
    replay(config: EngineConfig, wallets: WalletState) {
      setMode("replay");
      workerRef.current?.postMessage({
        type: "start",
        enabledExchanges: [],
        config,
        wallets,
      });
      workerRef.current?.postMessage({ type: "useReplay" });
    },
  };
}

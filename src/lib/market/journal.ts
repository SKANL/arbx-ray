import { openDB, type DBSchema } from "idb";
import type { OpportunityDecision, TradeEvent } from "./types";

type JournalEntry = {
  id: string;
  createdAt: number;
  kind: "decision" | "trade";
  payload: OpportunityDecision | TradeEvent;
};

interface ArbJournalDb extends DBSchema {
  journal: {
    key: string;
    value: JournalEntry;
    indexes: { "by-created": number };
  };
}

const dbName = "arbx-ray-journal";

async function getDb() {
  return openDB<ArbJournalDb>(dbName, 1, {
    upgrade(db) {
      const store = db.createObjectStore("journal", { keyPath: "id" });
      store.createIndex("by-created", "createdAt");
    },
  });
}

export async function saveJournalEntries(entries: JournalEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("journal", "readwrite");
  await Promise.all(entries.map((entry) => tx.store.put(entry)));
  await tx.done;
}

export async function loadRecentJournal(limit = 100): Promise<JournalEntry[]> {
  const db = await getDb();
  const entries = await db.getAllFromIndex("journal", "by-created");
  return entries.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export function decisionEntry(decision: OpportunityDecision): JournalEntry {
  return {
    id: `decision-${decision.id}`,
    createdAt: decision.observedAt,
    kind: "decision",
    payload: decision,
  };
}

export function tradeEntry(trade: TradeEvent): JournalEntry {
  return {
    id: trade.id,
    createdAt: trade.executedAt,
    kind: "trade",
    payload: trade,
  };
}

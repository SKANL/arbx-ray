import type { OpportunityDecision } from "./types";

export type EngineRouteState = "current-route" | "no-current-route" | "empty";

export type EnginePublication = {
  best?: OpportunityDecision;
  currentBest?: OpportunityDecision;
  latestDecision?: OpportunityDecision;
  lastTickAt: number;
  routeFreshnessMs?: number;
  routeState: EngineRouteState;
  routeMessage: string;
};

export function buildEnginePublication(input: {
  currentBest?: OpportunityDecision;
  recent: OpportunityDecision[];
  now?: number;
}): EnginePublication {
  const now = input.now ?? Date.now();
  const latestDecision = input.recent[0] ?? input.currentBest;
  const currentBest = input.currentBest;
  if (currentBest?.status === "accepted") {
    return {
      best: currentBest,
      currentBest,
      latestDecision,
      lastTickAt: now,
      routeFreshnessMs: Math.max(0, now - currentBest.observedAt),
      routeState: "current-route",
      routeMessage: "Current executable route from the latest live books.",
    };
  }
  if (currentBest?.status === "rejected") {
    const reason = currentBest.rejectionReasons[0] ?? "route rejected by execution gates";
    return {
      best: undefined,
      currentBest: undefined,
      latestDecision,
      lastTickAt: now,
      routeFreshnessMs: Math.max(0, now - currentBest.observedAt),
      routeState: "no-current-route",
      routeMessage: `No executable route in the latest books: ${reason}.`,
    };
  }
  return {
    best: undefined,
    currentBest: undefined,
    latestDecision,
    lastTickAt: now,
    routeFreshnessMs: undefined,
    routeState: latestDecision ? "no-current-route" : "empty",
    routeMessage: latestDecision
      ? "No executable route in the latest books; last decision remains in the journal."
      : "No route yet. Start live feeds or replay to collect books.",
  };
}

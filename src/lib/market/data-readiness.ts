import type { EngineRouteState } from "./engine-state";

export type DataReadinessTone = "green" | "amber" | "red" | "cyan" | "neutral";

export type DataReadinessItem = {
  id: "live" | "rest" | "replay" | "route";
  label: string;
  value: string;
  detail: string;
  progress: number;
  tone: DataReadinessTone;
};

export function buildDataReadinessRail(input: {
  enabledVenues: number;
  liveBooks: number;
  liveFeeds: number;
  restReady: number;
  restTotal: number;
  publicSources: number;
  replayTrades: number;
  currentRoute: boolean;
  routeState: EngineRouteState;
  routeMessage: string;
}): DataReadinessItem[] {
  const liveProgress = pct(input.liveBooks, input.enabledVenues);
  const restProgress = pct(input.restReady, input.restTotal);
  const replayProgress = Math.min(100, input.replayTrades * 10);
  return [
    {
      id: "live",
      label: "Live books",
      value: `${input.liveBooks}/${input.enabledVenues} books`,
      detail:
        input.liveBooks > 0
          ? `${input.liveFeeds} feeds are live; the worker is receiving public L2 evidence.`
          : "Start Live feeds to load WebSocket books and REST fallbacks.",
      progress: liveProgress,
      tone: liveProgress >= 60 ? "green" : liveProgress > 0 ? "amber" : "red",
    },
    {
      id: "rest",
      label: "REST oracles",
      value: `${input.restReady}/${input.restTotal} oracles`,
      detail:
        input.restReady > 0
          ? `${input.publicSources} public sources are available through serverless Route Handlers.`
          : "REST oracles are still loading or blocked by upstream public APIs.",
      progress: restProgress,
      tone: restProgress >= 85 ? "green" : restProgress >= 50 ? "amber" : "red",
    },
    {
      id: "replay",
      label: "Replay evidence",
      value: `${input.replayTrades} trades`,
      detail:
        input.replayTrades > 0
          ? "Historical replay can support walk-forward, regime, and conformal panels."
          : "Replay panels need historical simulated trades before robustness charts can load.",
      progress: replayProgress,
      tone: input.replayTrades >= 10 ? "green" : input.replayTrades > 0 ? "cyan" : "amber",
    },
    {
      id: "route",
      label: "Current route",
      value: input.currentRoute ? "current" : input.routeState === "no-current-route" ? "journal only" : "waiting",
      detail: input.routeMessage,
      progress: input.currentRoute ? 100 : input.routeState === "no-current-route" ? 45 : 15,
      tone: input.currentRoute ? "green" : "amber",
    },
  ];
}

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

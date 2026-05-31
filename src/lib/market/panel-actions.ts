export type DashboardPanelAction = "live" | "replay" | "backend";

export type SuggestedPanelAction = {
  id: DashboardPanelAction;
  label: string;
};

const ACTION_LABELS: Record<DashboardPanelAction, string> = {
  live: "Start live feeds",
  replay: "Run replay",
  backend: "Backend evidence",
};

export function suggestPanelActions(message: string): SuggestedPanelAction[] {
  const normalized = message.toLowerCase();
  const actions: DashboardPanelAction[] = [];

  if (mentionsLiveEvidence(normalized)) {
    actions.push("live");
  }
  if (mentionsReplayEvidence(normalized)) {
    actions.push("replay");
  }
  if (mentionsBackendEvidence(normalized)) {
    actions.push("backend");
  }

  return unique(actions).slice(0, 3).map((id) => ({ id, label: ACTION_LABELS[id] }));
}

function mentionsLiveEvidence(message: string): boolean {
  return [
    "live",
    "live feeds",
    "l2 depth",
    "bookmap",
    "same-lane books",
    "wallets initialize",
    "simulated wallets",
    "accepted route",
    "opportunity",
    "quant analysis",
    "stress scenarios",
  ].some((term) => message.includes(term));
}

function mentionsReplayEvidence(message: string): boolean {
  return [
    "replay",
    "historical",
    "walk-forward",
    "regime",
    "conformal",
    "strategy",
    "tournament",
    "equity curve",
    "deterministic",
    "journal",
    "stress scenarios",
  ].some((term) => message.includes(term));
}

function mentionsBackendEvidence(message: string): boolean {
  return [
    "rest",
    "route handler",
    "public",
    "oracle",
    "snapshot",
    "api",
    "coingecko",
    "mempool",
    "coinbase",
    "kraken",
    "bitstamp",
    "bitfinex",
    "okx",
    "kucoin",
    "bitso",
    "deribit",
    "bitmex",
  ].some((term) => message.includes(term));
}

function unique(actions: DashboardPanelAction[]): DashboardPanelAction[] {
  return actions.filter((action, index) => actions.indexOf(action) === index);
}

import type { DashboardView } from "./challenge-evidence";

export type ViewAction =
  | {
      id: "live" | "replay";
      label: string;
      detail: string;
      kind: "engine";
    }
  | {
      id: "backend" | "judge" | "cockpit" | "quant" | "market" | "mexico" | "backtest" | "risk";
      label: string;
      detail: string;
      kind: "navigate";
      view: DashboardView;
    };

export function buildViewActions(view: DashboardView): ViewAction[] {
  const actions: Record<DashboardView, ViewAction[]> = {
    cockpit: [
      engineAction("live", "Start live feeds", "Open public WebSockets and let the worker produce a current route."),
      navigateAction("judge", "Open judge board", "Show the challenge scorecard and proof trail.", "judge"),
    ],
    quant: [
      engineAction("live", "Feed quant models", "Use live L2 books and trade flow for latency, queue, Hawkes, and mirage panels."),
      engineAction("replay", "Run replay", "Generate deterministic evidence for probability, stress, and audit views."),
    ],
    market: [
      navigateAction("backend", "Audit API sources", "Show the serverless Route Handlers backing market-wide REST oracles.", "backend"),
      engineAction("live", "Refresh live depth", "Connect venue books so topology and live bookmap panels have fresh L2 evidence."),
    ],
    backend: [
      navigateAction("market", "Open market map", "Use backend snapshots in liquidity radar, price consensus, and smart routing.", "market"),
      navigateAction("judge", "Show full-stack proof", "Tie Route Handlers, manifests, and no-key public APIs to challenge criteria.", "judge"),
    ],
    mexico: [
      navigateAction("backend", "Check Bitso sources", "Confirm Mexico Corridor uses public serverless adapters, not static rates.", "backend"),
      navigateAction("judge", "Explain local edge", "Present the Mexico-specific route as challenge differentiation.", "judge"),
    ],
    triangular: [
      navigateAction("market", "Compare route classes", "Show cross-venue routing next to triangular graph simulation.", "market"),
      navigateAction("judge", "Show strategy breadth", "Prove the project is more than simple two-exchange spread scanning.", "judge"),
    ],
    backtest: [
      engineAction("replay", "Run replay", "Prime historical evidence for robustness, conformal guard, and strategy arena."),
      navigateAction("judge", "Open evidence route", "Show which replay panels close precision and robustness criteria.", "judge"),
    ],
    judge: [
      engineAction("live", "Start live demo", "Generate current public-data evidence before walking the judge path."),
      engineAction("replay", "Load deterministic proof", "Keep a reliable fallback when a public venue is temporarily unavailable."),
    ],
    replay: [
      engineAction("replay", "Run replay", "Create accepted/rejected decisions, wallets, P&L, and audit receipts."),
      engineAction("live", "Switch to live", "Return to current market feeds after the deterministic proof run."),
    ],
  };

  return actions[view];
}

function engineAction(id: "live" | "replay", label: string, detail: string): ViewAction {
  return { id, label, detail, kind: "engine" };
}

function navigateAction(
  id: Extract<ViewAction["id"], "backend" | "judge" | "cockpit" | "quant" | "market" | "mexico" | "backtest" | "risk">,
  label: string,
  detail: string,
  view: DashboardView,
): ViewAction {
  return { id, label, detail, kind: "navigate", view };
}

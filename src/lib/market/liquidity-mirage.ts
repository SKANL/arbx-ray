import type { SmartOrderRouterPlan } from "./smart-order-router";
import type { FillLevel, OpportunityDecision, SimulatedFill } from "./types";

export type LiquidityMiragePolicy = "allow" | "cap-size" | "wait-for-depth" | "halt-mirage";
export type LiquidityMirageFactorState = "pass" | "watch" | "fail";

export type LiquidityMirageFactor = {
  id: string;
  label: string;
  state: LiquidityMirageFactorState;
  value: number;
  threshold: number;
  unit: "bps" | "pct" | "score" | "levels" | "USD";
  explanation: string;
};

export type LiquidityMirageProfile = {
  side: "buy" | "sell";
  exchange: string;
  complete: boolean;
  topPrice: number;
  vwap: number;
  topLevelBtc: number;
  filledBtc: number;
  levelsUsed: number;
  slippageBps: number;
  concentrationPct: number;
  cliffBps: number;
};

export type LiquidityMirageDetector = {
  generatedAt: number;
  buy: LiquidityMirageProfile;
  sell: LiquidityMirageProfile;
  riskFactors: LiquidityMirageFactor[];
  reasons: string[];
  summary: {
    policy: LiquidityMiragePolicy;
    mirageScore: number;
    executableEdgeRetainedPct: number;
    depthConvexityBps: number;
    topOfBookEdgeBps: number;
    vwapEdgeBps: number;
    concentrationPct: number;
    smartRouterConfirmation: number;
  };
  equation: string;
};

export function buildLiquidityMirageDetector(input: {
  decision?: OpportunityDecision;
  smartOrderRouter?: SmartOrderRouterPlan;
  observedAt?: number;
}): LiquidityMirageDetector {
  const generatedAt = input.observedAt ?? Date.now();
  if (!input.decision) return emptyDetector(generatedAt);

  const decision = input.decision;
  const buy = profile("buy", decision.buyExchange, decision.buyFill);
  const sell = profile("sell", decision.sellExchange, decision.sellFill);
  const topOfBookEdgeBps = edgeBps(sell.topPrice, buy.topPrice);
  const vwapEdgeBps = edgeBps(sell.vwap, buy.vwap);
  const executableEdgeRetainedPct = topOfBookEdgeBps > 0 ? clamp((vwapEdgeBps / topOfBookEdgeBps) * 100, -100, 160) : 0;
  const depthConvexityBps = Math.max(0, buy.cliffBps + sell.cliffBps + buy.slippageBps + sell.slippageBps);
  const concentrationPct = Math.max(buy.concentrationPct, sell.concentrationPct);
  const smartRouterConfirmation = routerConfirmation(input.smartOrderRouter, decision);
  const riskFactors = [
    partialFillFactor(buy, sell),
    depthCliffFactor(depthConvexityBps),
    edgeRetentionFactor(executableEdgeRetainedPct),
    concentrationFactor(concentrationPct),
    routerFactor(smartRouterConfirmation, input.smartOrderRouter),
  ];
  const mirageScore = scoreMirage(riskFactors);
  const policy = choosePolicy({ mirageScore, riskFactors, executableEdgeRetainedPct, smartRouterConfirmation });
  const reasons = buildReasons({ policy, riskFactors, depthConvexityBps, executableEdgeRetainedPct });

  return {
    generatedAt,
    buy,
    sell,
    riskFactors,
    reasons,
    summary: {
      policy,
      mirageScore,
      executableEdgeRetainedPct: round(executableEdgeRetainedPct),
      depthConvexityBps: round(depthConvexityBps),
      topOfBookEdgeBps: round(topOfBookEdgeBps),
      vwapEdgeBps: round(vwapEdgeBps),
      concentrationPct: round(concentrationPct),
      smartRouterConfirmation,
    },
    equation:
      "mirage_score = fail_factors*24 + watch_factors*10 + depth_convexity_penalty + edge_decay_penalty + router_rejection_penalty; retained_edge = vwap_edge_bps / top_of_book_edge_bps",
  };
}

function profile(side: "buy" | "sell", exchange: string, fill: SimulatedFill): LiquidityMirageProfile {
  const topPrice = fill.levelsUsed[0]?.price ?? fill.vwap;
  const topLevelBtc = fill.levelsUsed[0]?.filledBtc ?? 0;
  const concentrationPct = fill.filledBtc > 0 ? (topLevelBtc / fill.filledBtc) * 100 : 100;
  return {
    side,
    exchange,
    complete: fill.complete,
    topPrice,
    vwap: fill.vwap,
    topLevelBtc,
    filledBtc: fill.filledBtc,
    levelsUsed: fill.levelsUsed.length,
    slippageBps: round(slippageFromTop(side, topPrice, fill.vwap)),
    concentrationPct: round(concentrationPct),
    cliffBps: round(depthCliffBps(side, fill.levelsUsed)),
  };
}

function partialFillFactor(buy: LiquidityMirageProfile, sell: LiquidityMirageProfile): LiquidityMirageFactor {
  const completeScore = (buy.complete ? 50 : 0) + (sell.complete ? 50 : 0);
  return {
    id: "partial-fill",
    label: "Fill completeness",
    state: completeScore === 100 ? "pass" : completeScore === 50 ? "watch" : "fail",
    value: completeScore,
    threshold: 100,
    unit: "pct",
    explanation:
      completeScore === 100
        ? "Both simulated legs fill the requested size."
        : "At least one leg cannot fill the requested size from visible depth.",
  };
}

function depthCliffFactor(depthConvexityBps: number): LiquidityMirageFactor {
  return {
    id: "depth-cliff",
    label: "Depth convexity",
    state: depthConvexityBps >= 60 ? "fail" : depthConvexityBps >= 18 ? "watch" : "pass",
    value: round(depthConvexityBps),
    threshold: 60,
    unit: "bps",
    explanation:
      depthConvexityBps >= 60
        ? "VWAP deteriorates sharply after the first visible levels."
        : "Depth walk does not show a severe liquidity cliff.",
  };
}

function edgeRetentionFactor(retainedPct: number): LiquidityMirageFactor {
  return {
    id: "edge-retention",
    label: "Executable edge retained",
    state: retainedPct < 35 ? "fail" : retainedPct < 70 ? "watch" : "pass",
    value: round(retainedPct),
    threshold: 70,
    unit: "pct",
    explanation:
      retainedPct < 35
        ? "Most of the apparent top-of-book spread disappears after depth walk."
        : "VWAP execution retains a meaningful share of the top-of-book edge.",
  };
}

function concentrationFactor(concentrationPct: number): LiquidityMirageFactor {
  return {
    id: "top-concentration",
    label: "Top-level concentration",
    state: concentrationPct >= 78 ? "fail" : concentrationPct >= 58 ? "watch" : "pass",
    value: round(concentrationPct),
    threshold: 78,
    unit: "pct",
    explanation:
      concentrationPct >= 78
        ? "A single top level dominates visible fill size, increasing quote-pull risk."
        : "Fill is distributed across multiple visible levels.",
  };
}

function routerFactor(confirmation: number, router: SmartOrderRouterPlan | undefined): LiquidityMirageFactor {
  return {
    id: "router-confirmation",
    label: "Smart-router confirmation",
    state: confirmation < 25 ? "fail" : confirmation < 55 ? "watch" : "pass",
    value: confirmation,
    threshold: 55,
    unit: "score",
    explanation:
      router?.summary.policy === "reject"
        ? "Broader REST depth sweep rejects the apparent route."
        : "Broader REST depth sweep confirms executable depth beyond the local route.",
  };
}

function routerConfirmation(router: SmartOrderRouterPlan | undefined, decision: OpportunityDecision): number {
  if (!router || router.summary.policy === "standby") return 35;
  if (router.summary.policy === "reject") return Math.max(0, 20 + Math.min(15, router.summary.netProfitUsd));
  const sizeRatio = decision.tradeSizeBtc > 0 ? router.summary.tradeSizeBtc / decision.tradeSizeBtc : 0;
  const pnlSignal = router.summary.netProfitUsd > 0 ? 24 : -18;
  const splitSignal = router.summary.policy === "split-route" ? 16 : router.summary.policy === "single-route" ? 8 : 0;
  const improvementSignal = clamp(router.summary.improvementUsd, -20, 24);
  return clampScore(34 + sizeRatio * 22 + pnlSignal + splitSignal + improvementSignal);
}

function scoreMirage(factors: LiquidityMirageFactor[]): number {
  const failPenalty = factors.filter((factor) => factor.state === "fail").length * 24;
  const watchPenalty = factors.filter((factor) => factor.state === "watch").length * 10;
  const depth = factors.find((factor) => factor.id === "depth-cliff")?.value ?? 0;
  const retained = factors.find((factor) => factor.id === "edge-retention")?.value ?? 0;
  const router = factors.find((factor) => factor.id === "router-confirmation")?.value ?? 50;
  const depthPenalty = Math.min(28, depth * 0.28);
  const edgePenalty = retained < 100 ? Math.min(28, (100 - retained) * 0.32) : 0;
  const routerPenalty = router < 55 ? Math.min(22, (55 - router) * 0.4) : 0;
  return clampScore(failPenalty + watchPenalty + depthPenalty + edgePenalty + routerPenalty);
}

function choosePolicy(input: {
  mirageScore: number;
  riskFactors: LiquidityMirageFactor[];
  executableEdgeRetainedPct: number;
  smartRouterConfirmation: number;
}): LiquidityMiragePolicy {
  const failCount = input.riskFactors.filter((factor) => factor.state === "fail").length;
  if (input.mirageScore >= 75 || failCount >= 3) return "halt-mirage";
  if (input.executableEdgeRetainedPct < 70 || input.smartRouterConfirmation < 55 || input.mirageScore >= 45) return "cap-size";
  if (input.riskFactors.some((factor) => factor.state === "watch")) return "wait-for-depth";
  return "allow";
}

function buildReasons(input: {
  policy: LiquidityMiragePolicy;
  riskFactors: LiquidityMirageFactor[];
  depthConvexityBps: number;
  executableEdgeRetainedPct: number;
}): string[] {
  const failed = input.riskFactors.filter((factor) => factor.state === "fail");
  return [
    input.policy === "halt-mirage"
      ? "liquidity mirage detected: apparent spread fails depth validation"
      : input.policy === "allow"
        ? "visible depth supports the executable edge"
        : "liquidity evidence requires smaller simulated sizing",
    `depth convexity ${round(input.depthConvexityBps)} bps`,
    `retained edge ${round(input.executableEdgeRetainedPct)}%`,
    ...failed.map((factor) => `${factor.label}: ${factor.explanation}`),
  ];
}

function edgeBps(sellPrice: number, buyPrice: number): number {
  const mid = (sellPrice + buyPrice) / 2;
  return mid > 0 ? ((sellPrice - buyPrice) / mid) * 10_000 : 0;
}

function slippageFromTop(side: "buy" | "sell", topPrice: number, vwap: number): number {
  if (topPrice <= 0 || vwap <= 0) return 0;
  const signed = side === "buy" ? vwap - topPrice : topPrice - vwap;
  return Math.max(0, (signed / topPrice) * 10_000);
}

function depthCliffBps(side: "buy" | "sell", levels: FillLevel[]): number {
  if (levels.length < 2) return 0;
  const topPrice = levels[0]?.price ?? 0;
  if (topPrice <= 0) return 0;
  const worstStep = levels.slice(1).reduce((max, level, index) => {
    const previous = levels[index]?.price ?? topPrice;
    const signed = side === "buy" ? level.price - previous : previous - level.price;
    return Math.max(max, (signed / topPrice) * 10_000);
  }, 0);
  const lastPrice = levels.at(-1)?.price ?? topPrice;
  const fullMove = side === "buy" ? lastPrice - topPrice : topPrice - lastPrice;
  return Math.max(0, worstStep, (fullMove / topPrice) * 10_000);
}

function emptyDetector(generatedAt: number): LiquidityMirageDetector {
  const emptyProfile: LiquidityMirageProfile = {
    side: "buy",
    exchange: "waiting",
    complete: false,
    topPrice: 0,
    vwap: 0,
    topLevelBtc: 0,
    filledBtc: 0,
    levelsUsed: 0,
    slippageBps: 0,
    concentrationPct: 100,
    cliffBps: 0,
  };
  return {
    generatedAt,
    buy: emptyProfile,
    sell: { ...emptyProfile, side: "sell" },
    riskFactors: [],
    reasons: ["waiting for a live or replay route"],
    summary: {
      policy: "wait-for-depth",
      mirageScore: 100,
      executableEdgeRetainedPct: 0,
      depthConvexityBps: 0,
      topOfBookEdgeBps: 0,
      vwapEdgeBps: 0,
      concentrationPct: 100,
      smartRouterConfirmation: 0,
    },
    equation:
      "mirage_score = fail_factors*24 + watch_factors*10 + depth_convexity_penalty + edge_decay_penalty + router_rejection_penalty; retained_edge = vwap_edge_bps / top_of_book_edge_bps",
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

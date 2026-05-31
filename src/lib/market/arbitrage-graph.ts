import type { LiquidityRadar, LiquidityRoute } from "./liquidity-radar";
import type { MexicoCorridorLab, MexicoCorridorLeg, MexicoCorridorRoute } from "./mexico-corridor";
import type { TriangularLab, TriangularLeg, TriangularRoute } from "./triangular";

export type GraphAsset = "USD" | "USDT" | "BTC" | "ETH" | "MXN";
export type GraphNodeKind = "venue" | "asset" | "synthetic";
export type GraphSource = "liquidity-radar" | "triangular" | "mexico-corridor";

export type ArbitrageGraphNode = {
  id: string;
  label: string;
  asset: GraphAsset;
  venue?: string;
  kind: GraphNodeKind;
};

export type ArbitrageGraphEdge = {
  id: string;
  from: string;
  to: string;
  venue: string;
  source: GraphSource;
  rate: number;
  weight: number;
  capacityUsd: number;
  expectedPnlUsd: number;
  evidence: string;
};

export type ArbitrageGraphCycle = {
  id: string;
  label: string;
  nodes: string[];
  edges: ArbitrageGraphEdge[];
  startAsset: GraphAsset;
  startAmountUsd: number;
  finalAmountUsd: number;
  netPnlUsd: number;
  netPnlBps: number;
  negativeWeight: number;
  complete: boolean;
  sourceMix: GraphSource[];
  rejectionReasons: string[];
};

export type CrossVenueArbitrageGraph = {
  generatedAt: number;
  nodes: ArbitrageGraphNode[];
  edges: ArbitrageGraphEdge[];
  cycles: ArbitrageGraphCycle[];
  summary: {
    policy: "execute-cycle" | "watch-graph" | "no-cycle" | "insufficient-data";
    nodeCount: number;
    edgeCount: number;
    cycleCount: number;
    bestCyclePnlUsd: number;
    bestCycleBps: number;
    bestCycleLabel?: string;
    hasNegativeCycle: boolean;
    proofScore: number;
  };
  reasons: string[];
  equation: string;
};

export function buildCrossVenueArbitrageGraph(input: {
  liquidityRadar?: LiquidityRadar;
  triangularLab?: TriangularLab;
  mexicoCorridor?: MexicoCorridorLab;
  generatedAt?: number;
}): CrossVenueArbitrageGraph {
  const builder = new GraphBuilder();
  const cycles: ArbitrageGraphCycle[] = [];
  for (const route of input.liquidityRadar?.routes ?? []) {
    const cycle = liquidityCycle(route, builder);
    if (cycle) cycles.push(cycle);
  }
  for (const route of input.triangularLab?.routes ?? []) {
    const cycle = triangularCycle(route, builder);
    if (cycle) cycles.push(cycle);
  }
  for (const route of input.mexicoCorridor?.routes ?? []) {
    const cycle = mexicoCycle(route, builder);
    if (cycle) cycles.push(cycle);
  }

  const profitableCycles = cycles
    .filter((cycle) => cycle.complete && cycle.netPnlUsd > 0 && cycle.negativeWeight < 0)
    .sort((a, b) => b.netPnlUsd - a.netPnlUsd || b.netPnlBps - a.netPnlBps);
  const nodes = builder.nodes();
  const edges = builder.edges();
  const hasNegativeCycle = detectNegativeCycle(nodes, profitableCycles.flatMap((cycle) => cycle.edges));
  const best = profitableCycles[0];
  const reasons = buildReasons({ nodes, edges, cycles: profitableCycles, hasNegativeCycle });
  const policy =
    nodes.length === 0 || edges.length === 0
      ? "insufficient-data"
      : best && hasNegativeCycle
        ? "execute-cycle"
        : profitableCycles.length > 0
          ? "watch-graph"
          : "no-cycle";

  return {
    generatedAt: input.generatedAt ?? Date.now(),
    nodes,
    edges,
    cycles: profitableCycles,
    summary: {
      policy,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      cycleCount: profitableCycles.length,
      bestCyclePnlUsd: best?.netPnlUsd ?? 0,
      bestCycleBps: best?.netPnlBps ?? 0,
      bestCycleLabel: best?.label,
      hasNegativeCycle,
      proofScore: proofScore({ policy, cycles: profitableCycles, edges, hasNegativeCycle }),
    },
    reasons,
    equation:
      "Build edge weight w = -log(rate_after_costs). Bellman-Ford flags arbitrage when a closed cycle has sum(w) < 0, equivalent to product(rate_after_costs) > 1 after depth, fees, latency, and rebalance costs.",
  };
}

function liquidityCycle(route: LiquidityRoute, builder: GraphBuilder): ArbitrageGraphCycle | undefined {
  const notionalUsd = route.tradeSizeBtc * route.buyVwap;
  const finalUsd = notionalUsd + route.netProfitUsd;
  const rate = safeRate(finalUsd, notionalUsd);
  const start = builder.node(`${route.buyExchange}:${route.quoteAsset}`, `${title(route.buyExchange)} ${route.quoteAsset}`, route.quoteAsset, route.buyExchange, "venue");
  const end = builder.node(`${route.sellExchange}:${route.quoteAsset}`, `${title(route.sellExchange)} ${route.quoteAsset}`, route.quoteAsset, route.sellExchange, "venue");
  const transferBack = builder.node(`${route.buyExchange}:rebalance-${route.quoteAsset}`, `${title(route.buyExchange)} rebalance`, route.quoteAsset, route.buyExchange, "synthetic");
  const edge = builder.edge({
    id: `liq:${route.quoteAsset}:${route.buyExchange}->${route.sellExchange}`,
    from: start.id,
    to: end.id,
    venue: `${route.buyExchange}->${route.sellExchange}`,
    source: "liquidity-radar",
    rate,
    capacityUsd: notionalUsd,
    expectedPnlUsd: route.netProfitUsd,
    evidence: `${route.quoteAsset} route buys ${route.tradeSizeBtc.toFixed(4)} BTC at ${round(route.buyVwap)} and sells at ${round(route.sellVwap)} after fees ${round(route.feeCostUsd)}, latency ${round(route.latencyCostUsd)}, and rebalance ${round(route.rebalanceCostUsd)}.`,
  });
  const transfer = builder.edge({
    id: `liq:${route.quoteAsset}:${route.sellExchange}->${route.buyExchange}:prefund`,
    from: end.id,
    to: transferBack.id,
    venue: "prefunded-ledger",
    source: "liquidity-radar",
    rate: 1,
    capacityUsd: notionalUsd,
    expectedPnlUsd: 0,
    evidence: "Synthetic prefunded-wallet rebalance edge closes the accounting loop without custody or private keys.",
  });
  const finalTransfer = builder.edge({
    id: `liq:${route.quoteAsset}:${route.buyExchange}:rebalance->wallet`,
    from: transferBack.id,
    to: start.id,
    venue: "prefunded-ledger",
    source: "liquidity-radar",
    rate: 1,
    capacityUsd: notionalUsd,
    expectedPnlUsd: 0,
    evidence: "Cycle closure models internal inventory normalization after the simulated route.",
  });
  return cycleFromEdges({
    id: `liquidity:${route.quoteAsset}:${route.buyExchange}-${route.sellExchange}`,
    label: `${title(route.buyExchange)} -> ${title(route.sellExchange)} ${route.quoteAsset} depth cycle`,
    edges: [edge, transfer, finalTransfer],
    startAsset: route.quoteAsset,
    startAmountUsd: notionalUsd,
    finalAmountUsd: finalUsd,
    netPnlUsd: route.netProfitUsd,
    netPnlBps: notionalUsd > 0 ? (route.netProfitUsd / notionalUsd) * 10_000 : 0,
    complete: route.complete,
    rejectionReasons: route.rejectionReasons,
  });
}

function triangularCycle(route: TriangularRoute, builder: GraphBuilder): ArbitrageGraphCycle | undefined {
  if (route.legs.length === 0) return undefined;
  const edges = route.legs.map((leg, index) => triangularEdge(route, leg, index, builder));
  return cycleFromEdges({
    id: `triangular:${route.id}`,
    label: route.label,
    edges,
    startAsset: "USD",
    startAmountUsd: route.startUsd,
    finalAmountUsd: route.finalUsd,
    netPnlUsd: route.netPnlUsd,
    netPnlBps: route.netPnlBps,
    complete: route.complete,
    rejectionReasons: route.rejectionReasons,
  });
}

function triangularEdge(
  route: TriangularRoute,
  leg: TriangularLeg,
  index: number,
  builder: GraphBuilder,
): ArbitrageGraphEdge {
  const from = builder.node(`coinbase:${leg.inputAsset}`, `Coinbase ${leg.inputAsset}`, leg.inputAsset, "coinbase", "venue");
  const to = builder.node(`coinbase:${leg.outputAsset}`, `Coinbase ${leg.outputAsset}`, leg.outputAsset, "coinbase", "venue");
  return builder.edge({
    id: `tri:${route.id}:${index}:${leg.inputAsset}->${leg.outputAsset}`,
    from: from.id,
    to: to.id,
    venue: "coinbase",
    source: "triangular",
    rate: safeRate(leg.outputAmount, leg.inputAmount),
    capacityUsd: route.startUsd,
    expectedPnlUsd: index === route.legs.length - 1 ? route.netPnlUsd : 0,
    evidence: `${leg.pair} ${leg.action} converts ${round(leg.inputAmount, 8)} ${leg.inputAsset} into ${round(leg.outputAmount, 8)} ${leg.outputAsset} across ${leg.levelsUsed} L2 level(s).`,
  });
}

function mexicoCycle(route: MexicoCorridorRoute, builder: GraphBuilder): ArbitrageGraphCycle | undefined {
  if (route.legs.length === 0) return undefined;
  const edges = route.legs.map((leg, index) => mexicoEdge(route, leg, index, builder));
  if (route.rebalanceCostUsd > 0 && route.finalUsd > 0) {
    edges.push(
      builder.edge({
        id: `mex:${route.id}:rebalance`,
        from: edges[edges.length - 1]?.to ?? "treasury:USD",
        to: edges[0]?.from ?? "treasury:USD",
        venue: "rebalance-policy",
        source: "mexico-corridor",
        rate: safeRate(route.finalUsd - route.rebalanceCostUsd, route.finalUsd),
        capacityUsd: route.finalUsd,
        expectedPnlUsd: -route.rebalanceCostUsd,
        evidence: `Rebalance haircut subtracts ${round(route.rebalanceCostUsd)} USD before closing the Mexico corridor loop.`,
      }),
    );
  }
  return cycleFromEdges({
    id: `mexico:${route.id}`,
    label: route.label,
    edges,
    startAsset: "USD",
    startAmountUsd: route.startUsd,
    finalAmountUsd: route.startUsd + route.netPnlUsd,
    netPnlUsd: route.netPnlUsd,
    netPnlBps: route.netPnlBps,
    complete: route.complete,
    rejectionReasons: route.rejectionReasons,
  });
}

function mexicoEdge(
  route: MexicoCorridorRoute,
  leg: MexicoCorridorLeg,
  index: number,
  builder: GraphBuilder,
): ArbitrageGraphEdge {
  const from = builder.node(`${leg.venue}:${leg.inputAsset}`, `${title(leg.venue)} ${leg.inputAsset}`, leg.inputAsset, leg.venue, "venue");
  const to = builder.node(`${leg.venue}:${leg.outputAsset}`, `${title(leg.venue)} ${leg.outputAsset}`, leg.outputAsset, leg.venue, "venue");
  return builder.edge({
    id: `mex:${route.id}:${index}:${leg.inputAsset}->${leg.outputAsset}`,
    from: from.id,
    to: to.id,
    venue: leg.venue,
    source: "mexico-corridor",
    rate: safeRate(leg.outputAmount, leg.inputAmount),
    capacityUsd: route.startUsd,
    expectedPnlUsd: index === route.legs.length - 1 ? route.grossEdgeUsd : 0,
    evidence: `${leg.pair} ${leg.action} converts ${round(leg.inputAmount, 8)} ${leg.inputAsset} into ${round(leg.outputAmount, 8)} ${leg.outputAsset} across ${leg.levelsUsed} level(s).`,
  });
}

function cycleFromEdges(input: {
  id: string;
  label: string;
  edges: ArbitrageGraphEdge[];
  startAsset: GraphAsset;
  startAmountUsd: number;
  finalAmountUsd: number;
  netPnlUsd: number;
  netPnlBps: number;
  complete: boolean;
  rejectionReasons: string[];
}): ArbitrageGraphCycle | undefined {
  if (input.edges.length === 0 || input.startAmountUsd <= 0) return undefined;
  const netRate = safeRate(input.finalAmountUsd, input.startAmountUsd);
  return {
    id: input.id,
    label: input.label,
    nodes: uniqueStrings([input.edges[0]?.from ?? "", ...input.edges.flatMap((edge) => [edge.from, edge.to])]),
    edges: input.edges,
    startAsset: input.startAsset,
    startAmountUsd: input.startAmountUsd,
    finalAmountUsd: input.finalAmountUsd,
    netPnlUsd: input.netPnlUsd,
    netPnlBps: input.netPnlBps,
    negativeWeight: -Math.log(netRate),
    complete: input.complete && input.rejectionReasons.length === 0,
    sourceMix: uniqueStrings(input.edges.map((edge) => edge.source)) as GraphSource[],
    rejectionReasons: uniqueStrings(input.rejectionReasons),
  };
}

function detectNegativeCycle(nodes: ArbitrageGraphNode[], edges: ArbitrageGraphEdge[]): boolean {
  if (nodes.length === 0 || edges.length === 0) return false;
  const distances = new Map(nodes.map((node) => [node.id, 0]));
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let relaxed = false;
    for (const edge of edges) {
      const from = distances.get(edge.from) ?? 0;
      const to = distances.get(edge.to) ?? 0;
      if (from + edge.weight < to - 1e-12) {
        distances.set(edge.to, from + edge.weight);
        relaxed = true;
        if (pass === nodes.length - 1) return true;
      }
    }
    if (!relaxed) return false;
  }
  return false;
}

function buildReasons(input: {
  nodes: ArbitrageGraphNode[];
  edges: ArbitrageGraphEdge[];
  cycles: ArbitrageGraphCycle[];
  hasNegativeCycle: boolean;
}): string[] {
  if (input.nodes.length === 0 || input.edges.length === 0) return ["Waiting for public route evidence before building the graph."];
  if (input.cycles.length === 0) return ["No profitable complete cycle survived fees, depth, and rebalance costs."];
  return [
    `${input.cycles.length} complete profitable cycle(s) converted into graph proof.`,
    input.hasNegativeCycle
      ? "Bellman-Ford detected at least one negative-weight cycle."
      : "Profitable candidates exist, but the global graph did not relax into a formal negative cycle.",
  ];
}

function proofScore(input: {
  policy: CrossVenueArbitrageGraph["summary"]["policy"];
  cycles: ArbitrageGraphCycle[];
  edges: ArbitrageGraphEdge[];
  hasNegativeCycle: boolean;
}): number {
  const bestBps = Math.max(0, input.cycles[0]?.netPnlBps ?? 0);
  const diversity = uniqueStrings(input.edges.map((edge) => edge.source)).length;
  const base = input.policy === "execute-cycle" ? 70 : input.policy === "watch-graph" ? 55 : input.policy === "no-cycle" ? 40 : 20;
  return clamp(base + Math.min(14, bestBps / 10) + diversity * 5 + (input.hasNegativeCycle ? 6 : 0));
}

class GraphBuilder {
  private readonly nodeMap = new Map<string, ArbitrageGraphNode>();
  private readonly edgeMap = new Map<string, ArbitrageGraphEdge>();

  node(id: string, label: string, asset: GraphAsset, venue?: string, kind: GraphNodeKind = "venue"): ArbitrageGraphNode {
    const existing = this.nodeMap.get(id);
    if (existing) return existing;
    const node = { id, label, asset, venue, kind };
    this.nodeMap.set(id, node);
    return node;
  }

  edge(input: Omit<ArbitrageGraphEdge, "weight">): ArbitrageGraphEdge {
    const rate = Number.isFinite(input.rate) && input.rate > 0 ? input.rate : 1e-12;
    const edge = {
      ...input,
      rate,
      weight: -Math.log(rate),
    };
    this.edgeMap.set(edge.id, edge);
    return edge;
  }

  nodes(): ArbitrageGraphNode[] {
    return [...this.nodeMap.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  edges(): ArbitrageGraphEdge[] {
    return [...this.edgeMap.values()];
  }
}

function safeRate(output: number, input: number): number {
  if (!Number.isFinite(output) || !Number.isFinite(input) || input <= 0 || output <= 0) return 1e-12;
  return output / input;
}

function uniqueStrings<T extends string>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

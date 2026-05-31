import type { OpportunityDecision } from "./types";

export type PnlWaterfallStep = {
  id: "gross" | "fees" | "withdrawal" | "latency" | "basis" | "net";
  label: string;
  valueUsd: number;
  runningUsd: number;
  kind: "gain" | "cost" | "net";
};

export function buildPnlWaterfall(decision: OpportunityDecision): PnlWaterfallStep[] {
  const gross = decision.grossProfitUsd;
  const fees = -decision.risk.feeCostUsd;
  const withdrawal = -decision.risk.withdrawalCostUsd;
  const latency = -decision.risk.latencyPenaltyUsd;
  const basis = decision.netProfitUsd - (gross + fees + withdrawal + latency);
  const costs = [
    { id: "fees" as const, label: "Taker fees", valueUsd: fees },
    { id: "withdrawal" as const, label: "Rebalance", valueUsd: withdrawal },
    { id: "latency" as const, label: "Latency", valueUsd: latency },
    { id: "basis" as const, label: "Basis", valueUsd: basis },
  ];

  let runningUsd = gross;
  const steps: PnlWaterfallStep[] = [
    {
      id: "gross",
      label: "Gross spread",
      valueUsd: gross,
      runningUsd,
      kind: "gain",
    },
  ];

  for (const cost of costs) {
    runningUsd += cost.valueUsd;
    steps.push({
      ...cost,
      runningUsd,
      kind: "cost",
    });
  }

  steps.push({
    id: "net",
    label: "Net P&L",
    valueUsd: decision.netProfitUsd,
    runningUsd: decision.netProfitUsd,
    kind: "net",
  });

  return steps;
}

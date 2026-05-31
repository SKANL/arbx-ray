import type { OpportunityDecision } from "./types";

export type DecisionGateStatus = "pass" | "warn" | "fail";

export type DecisionGate = {
  id: "net" | "fill" | "probability" | "risk" | "final";
  label: string;
  value: string;
  status: DecisionGateStatus;
  detail: string;
};

export function buildDecisionGateChecklist(decision: OpportunityDecision): DecisionGate[] {
  const fillComplete = decision.buyFill.complete && decision.sellFill.complete;
  const probabilityPct = decision.risk.positivePnlProbability * 100;
  const riskScore = decision.risk.score;
  return [
    {
      id: "net",
      label: "Net P&L",
      value: usd(decision.netProfitUsd),
      status: decision.netProfitUsd > 0 ? "pass" : "fail",
      detail:
        decision.netProfitUsd > 0
          ? "VWAP edge survives explicit costs."
          : "Costs, latency, or basis erase the spread.",
    },
    {
      id: "fill",
      label: "Depth fill",
      value: fillComplete ? "complete" : "partial",
      status: fillComplete ? "pass" : "fail",
      detail: `${decision.buyFill.levelsUsed.length} buy levels and ${decision.sellFill.levelsUsed.length} sell levels were walked.`,
    },
    {
      id: "probability",
      label: "P(win)",
      value: `${probabilityPct.toFixed(1)}%`,
      status: probabilityPct >= 75 ? "pass" : probabilityPct >= 45 ? "warn" : "fail",
      detail: "Monte Carlo-style execution risk from costs, latency, and microstructure.",
    },
    {
      id: "risk",
      label: "Risk score",
      value: `${riskScore.toFixed(1)}/100`,
      status: riskScore <= 45 ? "pass" : riskScore <= 70 ? "warn" : "fail",
      detail: "Lower is safer; high scores cap or reject routes even when net P&L is positive.",
    },
    {
      id: "final",
      label: "Final gate",
      value: decision.status,
      status: decision.status === "accepted" ? "pass" : "fail",
      detail:
        decision.status === "accepted"
          ? "All execution gates passed for the simulated route."
          : decision.rejectionReasons.join(", ") || "Rejected by risk governor.",
    },
  ];
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

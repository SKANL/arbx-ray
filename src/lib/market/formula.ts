import type { OpportunityDecision } from "./types";

export type FormulaVariable = {
  symbol: string;
  label: string;
  value?: string | number;
};

export type FormulaSpec = {
  title: string;
  equation: string;
  latex?: string;
  variables?: FormulaVariable[];
  plainExplanation: string;
  modelId: string;
};

export function splitFormulaLines(equation: string, maxLength = 82): string[] {
  const normalized = equation.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const segments = normalized
    .split(";")
    .map((segment, index, list) => (index < list.length - 1 ? `${segment.trim()};` : segment.trim()))
    .filter(Boolean);

  const lines: string[] = [];
  for (const segment of segments) {
    if (segment.length <= maxLength) {
      lines.push(segment);
      continue;
    }
    let current = "";
    const tokens = segment.split(/(\s[+\-*/]\s|\)\s-\s|\)\s\+\s)/).filter(Boolean);
    for (const token of tokens) {
      if (current && `${current}${token}`.length > maxLength) {
        lines.push(current.trim());
        current = token.trimStart();
      } else {
        current += token;
      }
    }
    if (current.trim()) lines.push(current.trim());
  }
  return lines;
}

export function buildDecisionNetFormula(decision: OpportunityDecision): FormulaSpec {
  const residualCostUsd =
    decision.grossProfitUsd -
    decision.risk.feeCostUsd -
    decision.risk.withdrawalCostUsd -
    decision.risk.latencyPenaltyUsd -
    decision.netProfitUsd;
  const statusPhrase = decision.status === "accepted" ? "accepted" : "rejected";
  return {
    title: "Executable Net P&L",
    modelId: "decision-net-pnl",
    equation:
      "gross_edge = sell_notional - buy_notional; " +
      "net_pnl = gross_edge - fee_cost - withdrawal_or_rebalance_cost - latency_haircut - basis_or_rounding_cost",
    variables: [
      { symbol: "sell_notional", label: "Sell-side executed notional", value: usd(decision.sellFill.notional) },
      { symbol: "buy_notional", label: "Buy-side executed notional", value: usd(decision.buyFill.notional) },
      { symbol: "gross_edge", label: "VWAP spread before execution costs", value: usd(decision.grossProfitUsd) },
      { symbol: "fee_cost", label: "Taker fees on both legs", value: usd(decision.risk.feeCostUsd) },
      { symbol: "withdrawal_or_rebalance_cost", label: "Simulated transfer/rebalance cost", value: usd(decision.risk.withdrawalCostUsd) },
      { symbol: "latency_haircut", label: "Feed-age and volatility haircut", value: usd(decision.risk.latencyPenaltyUsd) },
      { symbol: "basis_or_rounding_cost", label: "Quote-basis, residual, or rounding adjustment", value: usd(Math.max(0, residualCostUsd)) },
      { symbol: "net_pnl", label: `Final simulated result (${statusPhrase})`, value: usd(decision.netProfitUsd) },
    ],
    plainExplanation:
      `The route is marked ${statusPhrase}. The executable VWAP edge is ${usd(decision.grossProfitUsd)} ` +
      `before costs and ${usd(decision.netProfitUsd)} after fees, rebalance cost, latency haircut, ` +
      `and residual basis or rounding adjustments.${decision.rejectionReasons.length > 0 ? ` Gate reason: ${decision.rejectionReasons.join(", ")}.` : ""} ` +
      "No private keys or real orders are used.",
  };
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

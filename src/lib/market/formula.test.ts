import { describe, expect, it } from "vitest";
import { buildDecisionNetFormula, splitFormulaLines } from "./formula";
import type { OpportunityDecision } from "./types";

describe("formula helpers", () => {
  it("splits long formulas into readable segments without dropping terms", () => {
    const equation =
      "fill_probability = 1 - exp(-(aggressor_flow_btc_per_sec * horizon_sec) / (queue_ahead_btc + order_size_btc)); maker_ev = fill_probability*(spread_capture + fee_savings) - adverse_selection - (1-fill_probability)*missed_edge";

    const lines = splitFormulaLines(equation, 74);

    expect(lines.length).toBeGreaterThan(2);
    expect(lines.join(" ")).toContain("fill_probability");
    expect(lines.join(" ")).toContain("maker_ev");
    expect(lines.every((line) => line.length <= 90)).toBe(true);
  });

  it("turns a decision into a readable net P&L formula with current values", () => {
    const decision: OpportunityDecision = {
      id: "decision-1",
      status: "rejected",
      buyExchange: "bybit",
      sellExchange: "okx",
      quoteAsset: "USDT",
      observedAt: 1,
      tradeSizeBtc: 0.75,
      grossProfitUsd: 4.53,
      netProfitUsd: -112.76,
      buyFill: { filledBtc: 0.75, notional: 55_543.02, vwap: 74_057.36, complete: true, levelsUsed: [] },
      sellFill: { filledBtc: 0.75, notional: 55_547.55, vwap: 74_063.4, complete: true, levelsUsed: [] },
      impactCurve: [],
      microstructure: {
        buy: { midPrice: 1, spreadUsd: 1, spreadBps: 1, imbalance: 0, microprice: 1, pressure: "neutral" },
        sell: { midPrice: 1, spreadUsd: 1, spreadBps: 1, imbalance: 0, microprice: 1, pressure: "neutral" },
      },
      rejectionReasons: ["negative net pnl"],
      risk: {
        score: 81,
        latencyPenaltyUsd: 0.28,
        feeCostUsd: 111.09,
        withdrawalCostUsd: 5.92,
        grossProfitUsd: 4.53,
        positivePnlProbability: 0.001,
        reasons: [],
      },
      explanation: "raw formula",
    };

    const formula = buildDecisionNetFormula(decision);

    expect(formula.equation).toContain("net_pnl");
    expect(formula.equation).toContain("gross_edge");
    expect(formula.variables?.map((variable) => variable.symbol)).toContain("fee_cost");
    expect(formula.variables?.find((variable) => variable.symbol === "net_pnl")?.value).toBe("-$112.76");
    expect(formula.plainExplanation).toContain("rejected");
  });
});

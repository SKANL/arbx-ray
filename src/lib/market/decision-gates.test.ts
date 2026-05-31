import { describe, expect, it } from "vitest";
import { buildDecisionGateChecklist } from "./decision-gates";
import type { OpportunityDecision } from "./types";

const baseDecision: OpportunityDecision = {
  id: "gate",
  status: "rejected",
  buyExchange: "kraken",
  sellExchange: "coinbase",
  quoteAsset: "USD",
  observedAt: 1,
  tradeSizeBtc: 0.5,
  grossProfitUsd: 449.5,
  netProfitUsd: 111.42,
  buyFill: {
    filledBtc: 0.5,
    notional: 35_003,
    vwap: 70_006,
    complete: true,
    levelsUsed: [{ price: 70_006, requestedBtc: 0.5, filledBtc: 0.5, notional: 35_003 }],
  },
  sellFill: {
    filledBtc: 0.5,
    notional: 35_452.5,
    vwap: 70_905,
    complete: true,
    levelsUsed: [{ price: 70_905, requestedBtc: 0.5, filledBtc: 0.5, notional: 35_452.5 }],
  },
  impactCurve: [],
  microstructure: {
    buy: { midPrice: 70_000, spreadUsd: 1, spreadBps: 0.14, imbalance: 0, microprice: 70_000, pressure: "neutral" },
    sell: { midPrice: 70_500, spreadUsd: 1, spreadBps: 0.14, imbalance: 0, microprice: 70_500, pressure: "neutral" },
  },
  rejectionReasons: ["Risk score too high"],
  risk: {
    score: 81,
    latencyPenaltyUsd: 28.76,
    feeCostUsd: 303.72,
    withdrawalCostUsd: 5.6,
    grossProfitUsd: 449.5,
    positivePnlProbability: 0.999,
    reasons: [],
  },
  explanation: "raw",
};

describe("buildDecisionGateChecklist", () => {
  it("separates positive net P&L from a rejected final gate", () => {
    const gates = buildDecisionGateChecklist(baseDecision);

    expect(gates.find((gate) => gate.id === "net")).toMatchObject({ status: "pass", value: "$111.42" });
    expect(gates.find((gate) => gate.id === "risk")).toMatchObject({ status: "fail", value: "81.0/100" });
    expect(gates.find((gate) => gate.id === "final")).toMatchObject({
      status: "fail",
      detail: "Risk score too high",
    });
  });

  it("flags partial fills as an execution failure", () => {
    const gates = buildDecisionGateChecklist({
      ...baseDecision,
      buyFill: { ...baseDecision.buyFill, complete: false },
    });

    expect(gates.find((gate) => gate.id === "fill")).toMatchObject({ status: "fail", value: "partial" });
  });
});

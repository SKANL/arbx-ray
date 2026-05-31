import type { MarketContext } from "./context";
import type { FeedHealth, OpportunityDecision } from "./types";
import type { StressResult } from "./stress";

export type GovernorState = "normal" | "caution" | "halt";

export type GovernorRule = {
  id: string;
  label: string;
  state: GovernorState;
  message: string;
};

export type RiskGovernor = {
  state: GovernorState;
  score: number;
  action: string;
  rules: GovernorRule[];
};

export function buildRiskGovernor(input: {
  decision?: OpportunityDecision;
  context?: MarketContext;
  health: FeedHealth[];
  stressResults: StressResult[];
}): RiskGovernor {
  const rules: GovernorRule[] = [];
  const decision = input.decision;
  const volatility = input.context?.volatility.realizedVolBpsPerSecond ?? 0;
  const fastestFee = input.context?.mempoolFees?.fastestFee ?? 0;
  const sentiment = input.context?.sentiment?.value ?? 50;
  const unhealthyFeeds = input.health.filter((feed) => feed.status === "error" || feed.status === "stale");
  const stressSurvival =
    input.stressResults.length > 0
      ? input.stressResults.filter((result) => result.survives).length / input.stressResults.length
      : 0;

  if (!decision) {
    rules.push({
      id: "no-route",
      label: "No active route",
      state: "caution",
      message: "Wait for a comparable opportunity before allowing execution.",
    });
  } else if (decision.status !== "accepted") {
    rules.push({
      id: "route-rejected",
      label: "Route rejected",
      state: "halt",
      message: decision.rejectionReasons.join("; ") || "Current route failed execution policy.",
    });
  } else {
    rules.push({
      id: "route-accepted",
      label: "Route accepted",
      state: "normal",
      message: "Current route survives base execution checks.",
    });
  }

  if (volatility >= 8) {
    rules.push({
      id: "volatility-halt",
      label: "Volatility circuit",
      state: "halt",
      message: `${volatility.toFixed(2)} bps/s exceeds the hard volatility halt.`,
    });
  } else if (volatility >= 4) {
    rules.push({
      id: "volatility-caution",
      label: "Volatility caution",
      state: "caution",
      message: `${volatility.toFixed(2)} bps/s requires smaller sizing and slower execution.`,
    });
  }

  if (fastestFee >= 60) {
    rules.push({
      id: "network-halt",
      label: "Network fee halt",
      state: "halt",
      message: `${fastestFee} sat/vB makes rebalance assumptions hostile.`,
    });
  } else if (fastestFee >= 25) {
    rules.push({
      id: "network-caution",
      label: "Network fee caution",
      state: "caution",
      message: `${fastestFee} sat/vB increases rebalance cost assumptions.`,
    });
  }

  if (sentiment <= 20 || sentiment >= 85) {
    rules.push({
      id: "sentiment-caution",
      label: "Crowding caution",
      state: "caution",
      message: `Fear & Greed at ${sentiment}/100 implies crowded or stressed flow.`,
    });
  }

  if (input.health.length > 0 && unhealthyFeeds.length / input.health.length >= 0.5) {
    rules.push({
      id: "feed-halt",
      label: "Feed health halt",
      state: "halt",
      message: `${unhealthyFeeds.length}/${input.health.length} enabled feeds are stale or errored.`,
    });
  } else if (unhealthyFeeds.length > 0) {
    rules.push({
      id: "feed-caution",
      label: "Feed health caution",
      state: "caution",
      message: `${unhealthyFeeds.length} enabled feed(s) need recovery or replay fallback.`,
    });
  }

  if (input.stressResults.length > 0 && stressSurvival < 0.4) {
    rules.push({
      id: "stress-halt",
      label: "Stress survival halt",
      state: "halt",
      message: `${Math.round(stressSurvival * 100)}% of stress scenarios survive.`,
    });
  } else if (input.stressResults.length > 0 && stressSurvival < 0.8) {
    rules.push({
      id: "stress-caution",
      label: "Stress survival caution",
      state: "caution",
      message: `${Math.round(stressSurvival * 100)}% of stress scenarios survive; cap size.`,
    });
  }

  const state = rules.some((rule) => rule.state === "halt")
    ? "halt"
    : rules.some((rule) => rule.state === "caution")
      ? "caution"
      : "normal";
  const score = Math.max(
    0,
    100 - rules.filter((rule) => rule.state === "halt").length * 35 - rules.filter((rule) => rule.state === "caution").length * 12,
  );
  return {
    state,
    score,
    action:
      state === "halt"
        ? "Block simulated execution until the blocking condition clears."
        : state === "caution"
          ? "Allow only capped sizing and require replay fallback readiness."
          : "Execution policy allows normal simulated sizing.",
    rules,
  };
}

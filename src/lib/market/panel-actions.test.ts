import { describe, expect, it } from "vitest";
import { suggestPanelActions } from "./panel-actions";

describe("suggestPanelActions", () => {
  it("recommends live and replay for route-dependent panels", () => {
    expect(suggestPanelActions("Start live feeds or replay to generate a quant analysis.")).toEqual([
      { id: "live", label: "Start live feeds" },
      { id: "replay", label: "Run replay" },
    ]);
  });

  it("recommends backend evidence for public REST oracle loading states", () => {
    expect(suggestPanelActions("Loading public REST snapshots from Coinbase, Kraken, OKX, and KuCoin.")).toEqual([
      { id: "backend", label: "Backend evidence" },
    ]);
  });

  it("recommends replay for historical robustness panels", () => {
    expect(suggestPanelActions("Load historical replay to run the policy tournament and regret comparison.")).toEqual([
      { id: "replay", label: "Run replay" },
    ]);
  });
});

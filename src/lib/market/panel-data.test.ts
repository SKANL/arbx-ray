import { describe, expect, it } from "vitest";
import { errorPanelData, insufficientPanelData, panelReady, readyPanelData } from "./panel-data";

describe("panel data state", () => {
  it("tracks source and last success for ready panel data", () => {
    const state = readyPanelData({ value: 42 }, { source: "/api/example", now: 1_000 });

    expect(state.status).toBe("ready");
    expect(state.data?.value).toBe(42);
    expect(state.source).toBe("/api/example");
    expect(state.lastUpdatedAt).toBe(1_000);
    expect(panelReady(state)).toBe(true);
  });

  it("distinguishes insufficient data from transport errors", () => {
    const insufficient = insufficientPanelData("Need accepted trades", {
      source: "worker",
      prerequisite: "accepted trades >= 2",
      now: 2_000,
    });
    const failed = errorPanelData("HTTP 429", { source: "/api/trade-tape", now: 3_000 });

    expect(insufficient.status).toBe("insufficient");
    expect(insufficient.prerequisite).toBe("accepted trades >= 2");
    expect(failed.status).toBe("error");
    expect(failed.error).toBe("HTTP 429");
  });
});

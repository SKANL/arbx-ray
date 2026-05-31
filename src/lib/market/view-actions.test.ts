import { describe, expect, it } from "vitest";
import { buildViewActions } from "./view-actions";

describe("buildViewActions", () => {
  it("gives cockpit a live proof action and judge navigation", () => {
    expect(buildViewActions("cockpit").map((action) => action.id)).toEqual(["live", "judge"]);
  });

  it("routes backend views toward market evidence and full-stack proof", () => {
    const actions = buildViewActions("backend");

    expect(actions).toContainEqual(
      expect.objectContaining({ id: "market", kind: "navigate", view: "market" }),
    );
    expect(actions).toContainEqual(
      expect.objectContaining({ id: "judge", kind: "navigate", view: "judge" }),
    );
  });

  it("keeps judge mode focused on live and deterministic proof runs", () => {
    expect(buildViewActions("judge").map((action) => action.id)).toEqual(["live", "replay"]);
  });
});

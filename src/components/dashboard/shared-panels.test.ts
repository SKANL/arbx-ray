import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartFrame, AccessibleChartSvg } from "./chart-frame";
import { EmptyState } from "./empty-state";
import { FormulaExplainer } from "./formula-explainer";

describe("dashboard shared panels", () => {
  it("wraps long formulas through the reusable formula explainer", () => {
    const html = renderToStaticMarkup(
      createElement(FormulaExplainer, {
        spec: {
          title: "Long formula",
          modelId: "test-model",
          equation: "net = spread - taker_fee - withdrawal_cost - latency_haircut - basis_haircut - inventory_penalty",
          plainExplanation: "Explains the route using public market inputs.",
          variables: [{ symbol: "net", label: "net profit", value: "$12.34" }],
        },
      }),
    );

    expect(html).toContain("Long formula");
    expect(html).toContain("test-model");
    expect(html).toContain("break-words");
    expect(html).toContain("net profit: $12.34");
  });

  it("renders chart metadata and metrics without requiring chart data", () => {
    const html = renderToStaticMarkup(
      createElement(
        ChartFrame,
        {
          title: "P&L curve",
          source: "simulated fills",
          description: "Needs accepted trades",
          metrics: [{ label: "Marks", value: "0", tone: "neutral" }],
        },
        createElement(AccessibleChartSvg, { title: "Empty chart", description: "No points yet" }),
      ),
    );

    expect(html).toContain("P&amp;L curve");
    expect(html).toContain("simulated fills");
    expect(html).toContain("Marks");
    expect(html).toContain("No points yet");
  });

  it("renders empty states with source and prerequisite evidence", () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        text: "P&L curve needs at least two accepted simulated trades. Use Replay for deterministic fills.",
        source: "simulated fills",
        prerequisite: "2 accepted trades",
      }),
    );

    expect(html).toContain("Waiting for evidence");
    expect(html).toContain("simulated fills");
    expect(html).toContain("2 accepted trades");
    expect(html).toContain("Run replay");
  });
});

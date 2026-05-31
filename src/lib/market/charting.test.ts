import { describe, expect, it } from "vitest";
import { buildPolylinePoints, chartDomain, summarizeChartSeries } from "./charting";

describe("charting helpers", () => {
  it("returns a stable domain for empty and flat datasets", () => {
    expect(chartDomain([])).toEqual({ min: 0, max: 1, range: 1 });
    expect(chartDomain([5, 5, 5])).toEqual({ min: 4, max: 6, range: 2 });
  });

  it("builds finite responsive polyline points", () => {
    const points = buildPolylinePoints([10, -5, 20], { width: 100, height: 100, padding: 8 });

    expect(points).toHaveLength(3);
    expect(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    expect(points[0].x).toBe(8);
    expect(points[2].x).toBe(92);
  });

  it("summarizes chart series for readable chart headers", () => {
    expect(summarizeChartSeries([2, 4, 9, Number.NaN])).toEqual({
      count: 3,
      min: 2,
      max: 9,
      first: 2,
      last: 9,
      delta: 7,
      trend: "up",
    });
    expect(summarizeChartSeries([5, 5])).toMatchObject({ count: 2, delta: 0, trend: "flat" });
    expect(summarizeChartSeries([])).toMatchObject({ count: 0, trend: "empty" });
  });
});

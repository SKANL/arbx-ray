export type ChartDomain = {
  min: number;
  max: number;
  range: number;
};

export type ChartPoint = {
  x: number;
  y: number;
};

export type ChartSeriesTrend = "up" | "down" | "flat" | "empty";

export type ChartSeriesSummary = {
  count: number;
  min: number;
  max: number;
  first: number;
  last: number;
  delta: number;
  trend: ChartSeriesTrend;
};

export function chartDomain(values: number[]): ChartDomain {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { min: 0, max: 1, range: 1 };
  const minValue = Math.min(...finite);
  const maxValue = Math.max(...finite);
  if (minValue === maxValue) {
    const pad = Math.max(1, Math.abs(minValue) * 0.1);
    return { min: minValue - pad, max: maxValue + pad, range: pad * 2 };
  }
  const pad = Math.max((maxValue - minValue) * 0.08, 0.000001);
  const min = minValue - pad;
  const max = maxValue + pad;
  return { min, max, range: max - min };
}

export function buildPolylinePoints(
  values: number[],
  options: { width?: number; height?: number; padding?: number } = {},
): ChartPoint[] {
  const width = options.width ?? 100;
  const height = options.height ?? 100;
  const padding = options.padding ?? 0;
  const domain = chartDomain(values);
  const safeWidth = Math.max(1, width - padding * 2);
  const safeHeight = Math.max(1, height - padding * 2);
  if (values.length === 0) return [];
  if (values.length === 1) {
    return [{ x: width / 2, y: padding + safeHeight / 2 }];
  }
  return values.map((value, index) => ({
    x: padding + (index / (values.length - 1)) * safeWidth,
    y: padding + (1 - (value - domain.min) / domain.range) * safeHeight,
  }));
}

export function polylineAttribute(points: ChartPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

export function summarizeChartSeries(values: number[]): ChartSeriesSummary {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) {
    return { count: 0, min: 0, max: 0, first: 0, last: 0, delta: 0, trend: "empty" };
  }
  const first = finite[0];
  const last = finite[finite.length - 1];
  const delta = last - first;
  return {
    count: finite.length,
    min: Math.min(...finite),
    max: Math.max(...finite),
    first,
    last,
    delta,
    trend: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

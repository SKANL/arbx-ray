import { useId, type ReactNode } from "react";
import { Badge } from "../ui/badge";

export type ChartFrameMetric = {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "red" | "amber" | "cyan";
};

export function ChartFrame({
  title,
  source,
  children,
  description,
  metrics,
}: {
  title: string;
  source: string;
  children?: ReactNode;
  description?: string;
  metrics?: ChartFrameMetric[];
}) {
  return (
    <figure className="rounded border border-zinc-800 bg-zinc-950 p-3" aria-label={`${title}: ${description ?? source}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{title}</div>
          {description ? <div className="mt-1 text-xs leading-5 text-zinc-500">{description}</div> : null}
        </div>
        <Badge tone="neutral">{source}</Badge>
      </div>
      {metrics && metrics.length > 0 ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={`${metric.label}-${metric.value}`} className="rounded border border-zinc-800 bg-zinc-900/70 p-2">
              <div className="text-[10px] uppercase text-zinc-500">{metric.label}</div>
              <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
                <span className={`truncate text-xs font-semibold tabular-nums ${chartMetricValueClass(metric.tone)}`}>
                  {metric.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {children}
    </figure>
  );
}

export function AccessibleChartSvg({
  title,
  description,
  children,
  className = "h-52",
  viewBox = "0 0 100 100",
}: {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
  viewBox?: string;
}) {
  const chartId = useId();
  const titleId = `${chartId}-title`;
  const descriptionId = `${chartId}-description`;
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-labelledby={`${titleId} ${descriptionId}`}
      className={`w-full overflow-visible ${className}`}
    >
      <title id={titleId}>{title}</title>
      <desc id={descriptionId}>{description}</desc>
      {children}
    </svg>
  );
}

function chartMetricValueClass(tone: ChartFrameMetric["tone"]): string {
  if (tone === "green") return "text-emerald-200";
  if (tone === "red") return "text-red-200";
  if (tone === "amber") return "text-amber-200";
  if (tone === "cyan") return "text-cyan-200";
  return "text-zinc-100";
}

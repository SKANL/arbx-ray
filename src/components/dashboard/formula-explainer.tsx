import { Badge } from "../ui/badge";
import { splitFormulaLines, type FormulaSpec, type FormulaVariable } from "../../lib/market/formula";

export function FormulaExplainer({
  spec,
  variables = spec.variables ?? [],
}: {
  spec: FormulaSpec;
  variables?: FormulaVariable[];
}) {
  const lines = splitFormulaLines(spec.equation);
  return (
    <div className="mt-4 overflow-hidden rounded border border-zinc-800 bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <div>
          <div className="text-xs uppercase text-zinc-500">{spec.modelId}</div>
          <div className="text-sm font-semibold text-zinc-100">{spec.title}</div>
        </div>
        <Badge tone="cyan">formula</Badge>
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded border border-zinc-800 bg-black p-3 font-mono text-[12px] leading-6 text-cyan-100">
          {lines.map((line, index) => (
            <div key={`${spec.modelId}-${index}`} className="break-words">
              {line}
            </div>
          ))}
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="text-xs uppercase text-zinc-500">Variables</div>
          {variables.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {variables.map((variable) => (
                <div key={variable.symbol} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2 text-xs">
                  <span className="font-mono text-cyan-100">{variable.symbol}</span>
                  <span className="min-w-0 break-words text-zinc-300">
                    {variable.value !== undefined ? `${variable.label}: ${variable.value}` : variable.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs leading-5 text-zinc-400">Derived from the live route and public market inputs.</div>
          )}
        </div>
      </div>
      <div className="border-t border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs leading-5 text-cyan-100">
        {spec.plainExplanation}
      </div>
    </div>
  );
}

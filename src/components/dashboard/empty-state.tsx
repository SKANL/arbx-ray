import { AlertTriangle, Database, History, Play } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "../ui/empty";
import { suggestPanelActions, type DashboardPanelAction } from "../../lib/market/panel-actions";

export function EmptyState({
  text,
  source,
  prerequisite,
}: {
  text: string;
  source?: string;
  prerequisite?: string;
}) {
  const actions = suggestPanelActions(text);
  return (
    <Empty className="min-h-28 rounded border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-4">
      <EmptyMedia>
        <AlertTriangle size={16} className="text-amber-400" />
      </EmptyMedia>
      <EmptyTitle>Waiting for evidence</EmptyTitle>
      <EmptyDescription>{text}</EmptyDescription>
      {(source || prerequisite || actions.length > 0) && (
        <EmptyContent className="flex flex-col items-center gap-3">
          {(source || prerequisite) && (
            <div className="flex flex-wrap justify-center gap-2 text-[11px] uppercase">
              {source ? <Badge tone="neutral">{source}</Badge> : null}
              {prerequisite ? <Badge tone="amber">{prerequisite}</Badge> : null}
            </div>
          )}
          {actions.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {actions.map((action) => (
                <Button
                  key={action.id}
                  className="h-auto min-h-8 whitespace-normal text-left leading-4"
                  onClick={() => dispatchPanelAction(action.id)}
                  size="sm"
                  type="button"
                  variant={action.id === "backend" ? "ghost" : "outline"}
                >
                  {panelActionIcon(action.id)}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </EmptyContent>
      )}
    </Empty>
  );
}

export function dispatchPanelAction(action: DashboardPanelAction) {
  window.dispatchEvent(new CustomEvent<DashboardPanelAction>("arbx:panel-action", { detail: action }));
}

function panelActionIcon(action: DashboardPanelAction): ReactNode {
  if (action === "live") return <Play size={14} aria-hidden="true" />;
  if (action === "replay") return <History size={14} aria-hidden="true" />;
  return <Database size={14} aria-hidden="true" />;
}

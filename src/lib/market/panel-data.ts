export type PanelDataStatus = "idle" | "loading" | "ready" | "empty" | "insufficient" | "error";

export type PanelDataState<T> = {
  status: PanelDataStatus;
  source: string;
  data?: T;
  lastUpdatedAt?: number;
  error?: string;
  message?: string;
  prerequisite?: string;
};

type PanelMeta = {
  source: string;
  now?: number;
  prerequisite?: string;
};

export function loadingPanelData<T>(source: string): PanelDataState<T> {
  return { status: "loading", source };
}

export function readyPanelData<T>(data: T, meta: PanelMeta): PanelDataState<T> {
  return { status: "ready", data, source: meta.source, lastUpdatedAt: meta.now ?? Date.now() };
}

export function emptyPanelData<T>(message: string, meta: PanelMeta): PanelDataState<T> {
  return {
    status: "empty",
    message,
    source: meta.source,
    prerequisite: meta.prerequisite,
    lastUpdatedAt: meta.now ?? Date.now(),
  };
}

export function insufficientPanelData<T>(message: string, meta: PanelMeta): PanelDataState<T> {
  return {
    status: "insufficient",
    message,
    source: meta.source,
    prerequisite: meta.prerequisite,
    lastUpdatedAt: meta.now ?? Date.now(),
  };
}

export function errorPanelData<T>(error: string, meta: PanelMeta): PanelDataState<T> {
  return { status: "error", error, source: meta.source, lastUpdatedAt: meta.now ?? Date.now() };
}

export function panelReady<T>(state: PanelDataState<T>): state is PanelDataState<T> & { data: T } {
  return state.status === "ready" && state.data !== undefined;
}

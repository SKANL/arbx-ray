"use client";

import { useCallback, useEffect, useState } from "react";
import { findDashboardPublicEndpoint, type DashboardPublicEndpointKey } from "@/lib/dashboard/public-data";
import { errorPanelData, loadingPanelData, readyPanelData, type PanelDataState } from "@/lib/market/panel-data";
import type { BackendHealth, BackendManifest } from "@/lib/market/backend-manifest";
import type { CashCarryLab } from "@/lib/market/cash-carry";
import type { DerivativesPressureOracle } from "@/lib/market/derivatives-pressure";
import type { HistoricalReplay } from "@/lib/market/historical";
import type { LeadLagOracle } from "@/lib/market/lead-lag";
import type { LiquidityRadar } from "@/lib/market/liquidity-radar";
import type { MarketContext } from "@/lib/market/context";
import type { MexicoCorridorLab } from "@/lib/market/mexico-corridor";
import type { OptionsIvOracle } from "@/lib/market/options-iv";
import type { PriceConsensusOracle } from "@/lib/market/price-consensus";
import type { SettlementRiskOracle } from "@/lib/market/settlement-risk";
import type { TradeTapeToxicity } from "@/lib/market/trade-tape";
import type { TriangularLab } from "@/lib/market/triangular";
import type { UsdtBasisOracle } from "@/lib/market/usdt-basis";
import type { VenueLatencyRace } from "@/lib/market/venue-latency";
import type { VenueIntelligence } from "@/lib/market/venue-intelligence";
import type { VenueReliabilityOracle } from "@/lib/market/venue-reliability";

export type BackendEvidenceState = {
  status: "loading" | "ready" | "error";
  manifest?: BackendManifest;
  health?: BackendHealth;
  latencyMs?: number;
  checkedAt?: number;
  error?: string;
};

export type DashboardPublicData = {
  backendEvidence: BackendEvidenceState;
  marketContext?: MarketContext;
  cashCarryLab?: CashCarryLab;
  settlementRisk?: SettlementRiskOracle;
  derivativesPressure?: DerivativesPressureOracle;
  optionsIv?: OptionsIvOracle;
  historicalReplay?: HistoricalReplay;
  venueIntelligence?: VenueIntelligence;
  liquidityRadar?: LiquidityRadar;
  mexicoCorridor?: MexicoCorridorLab;
  priceConsensus?: PriceConsensusOracle;
  usdtBasis?: UsdtBasisOracle;
  tradeTape?: TradeTapeToxicity;
  leadLag?: LeadLagOracle;
  venueLatency?: VenueLatencyRace;
  venueReliability?: VenueReliabilityOracle;
  triangularLab?: TriangularLab;
  panelStates: Record<DashboardPublicEndpointKey, PanelDataState<unknown>>;
  refreshPublicData: () => void;
};

export function useDashboardPublicData(): DashboardPublicData {
  const [refreshSignal, setRefreshSignal] = useState(0);
  const backendEvidence = useBackendEvidence();
  const marketContext = useEndpointData<MarketContext>("marketContext", refreshSignal);
  const settlementRisk = useEndpointData<SettlementRiskOracle>("settlementRisk", refreshSignal);
  const cashCarryLab = useEndpointData<CashCarryLab>("cashCarryLab", refreshSignal);
  const venueIntelligence = useEndpointData<VenueIntelligence>("venueIntelligence", refreshSignal);
  const derivativesPressure = useEndpointData<DerivativesPressureOracle>("derivativesPressure", refreshSignal);
  const optionsIv = useEndpointData<OptionsIvOracle>("optionsIv", refreshSignal);
  const liquidityRadar = useEndpointData<LiquidityRadar>("liquidityRadar", refreshSignal);
  const priceConsensus = useEndpointData<PriceConsensusOracle>("priceConsensus", refreshSignal);
  const tradeTape = useEndpointData<TradeTapeToxicity>("tradeTape", refreshSignal);
  const leadLag = useEndpointData<LeadLagOracle>("leadLag", refreshSignal);
  const usdtBasis = useEndpointData<UsdtBasisOracle>("usdtBasis", refreshSignal);
  const mexicoCorridor = useEndpointData<MexicoCorridorLab>("mexicoCorridor", refreshSignal);
  const venueLatency = useEndpointData<VenueLatencyRace>("venueLatency", refreshSignal);
  const venueReliability = useEndpointData<VenueReliabilityOracle>("venueReliability", refreshSignal);
  const historicalReplay = useEndpointData<HistoricalReplay>("historicalReplay", refreshSignal);
  const triangularLab = useEndpointData<TriangularLab>("triangularLab", refreshSignal);
  const refreshPublicData = useCallback(() => setRefreshSignal((value) => value + 1), []);

  return {
    backendEvidence,
    marketContext: marketContext.data,
    cashCarryLab: cashCarryLab.data,
    settlementRisk: settlementRisk.data,
    derivativesPressure: derivativesPressure.data,
    optionsIv: optionsIv.data,
    historicalReplay: historicalReplay.data,
    venueIntelligence: venueIntelligence.data,
    liquidityRadar: liquidityRadar.data,
    mexicoCorridor: mexicoCorridor.data,
    priceConsensus: priceConsensus.data,
    usdtBasis: usdtBasis.data,
    tradeTape: tradeTape.data,
    leadLag: leadLag.data,
    venueLatency: venueLatency.data,
    venueReliability: venueReliability.data,
    triangularLab: triangularLab.data,
    panelStates: {
      marketContext,
      settlementRisk,
      cashCarryLab,
      venueIntelligence,
      derivativesPressure,
      optionsIv,
      liquidityRadar,
      priceConsensus,
      tradeTape,
      leadLag,
      usdtBasis,
      mexicoCorridor,
      venueLatency,
      venueReliability,
      historicalReplay,
      triangularLab,
    },
    refreshPublicData,
  };
}

function useEndpointData<T>(key: DashboardPublicEndpointKey, refreshSignal: number): PanelDataState<T> {
  const endpoint = findDashboardPublicEndpoint(key);
  const [state, setState] = useState<PanelDataState<T>>(() => loadingPanelData(endpoint.path));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState(loadingPanelData(endpoint.path));
      try {
        const response = await fetch(endpoint.path, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const data = (await response.json()) as T;
        if (!cancelled) {
          setState(readyPanelData(data, { source: endpoint.path }));
        }
      } catch (error) {
        if (!cancelled) {
          setState(errorPanelData(error instanceof Error ? error.message : "unknown public data error", { source: endpoint.path }));
        }
      }
    }

    void load();
    if (endpoint.intervalMs === null) {
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setInterval(load, endpoint.intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [endpoint.intervalMs, endpoint.path, refreshSignal]);

  return state;
}

function useBackendEvidence(): BackendEvidenceState {
  const [backendEvidence, setBackendEvidence] = useState<BackendEvidenceState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function loadBackendEvidence() {
      const started = performance.now();
      try {
        const [healthResponse, manifestResponse] = await Promise.all([
          fetch("/api/health", { cache: "no-store" }),
          fetch("/api/backend-manifest", { cache: "no-store" }),
        ]);
        if (!healthResponse.ok || !manifestResponse.ok) {
          throw new Error(`health ${healthResponse.status}, manifest ${manifestResponse.status}`);
        }
        const [healthPayload, manifestPayload] = await Promise.all([
          healthResponse.json() as Promise<BackendHealth>,
          manifestResponse.json() as Promise<BackendManifest>,
        ]);
        if (!cancelled) {
          setBackendEvidence({
            status: "ready",
            health: healthPayload,
            manifest: manifestPayload,
            latencyMs: performance.now() - started,
            checkedAt: Date.now(),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setBackendEvidence({
            status: "error",
            latencyMs: performance.now() - started,
            checkedAt: Date.now(),
            error: error instanceof Error ? error.message : "unknown backend evidence error",
          });
        }
      }
    }
    void loadBackendEvidence();
    const timer = window.setInterval(loadBackendEvidence, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return backendEvidence;
}

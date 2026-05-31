import { NextResponse } from "next/server";
import { buildVenueLatencyRace, type VenueLatencyProbe, type VenueLatencySample } from "@/lib/market/venue-latency";

const probes = [
  { venue: "binance", label: "Binance", endpoint: "https://api.binance.com/api/v3/ping" },
  { venue: "kraken", label: "Kraken", endpoint: "https://api.kraken.com/0/public/Time" },
  { venue: "coinbase", label: "Coinbase", endpoint: "https://api.coinbase.com/v2/time" },
  { venue: "bitso", label: "Bitso", endpoint: "https://api.bitso.com/v3/available_books/" },
  { venue: "okx", label: "OKX", endpoint: "https://www.okx.com/api/v5/public/time" },
  { venue: "bitstamp", label: "Bitstamp", endpoint: "https://www.bitstamp.net/api/v2/ticker/btcusd/" },
];

export async function GET() {
  const measured = await Promise.all(
    probes.map(async (probe): Promise<VenueLatencyProbe> => ({
      ...probe,
      samples: await measureEndpoint(probe.endpoint, 3),
    })),
  );

  return NextResponse.json(
    buildVenueLatencyRace({
      probes: measured,
      latencyBudgetMs: 900,
      notionalUsd: 50_000,
      realizedVolBpsPerSecond: 8,
      generatedAt: Date.now(),
    }),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function measureEndpoint(endpoint: string, samples: number): Promise<VenueLatencySample[]> {
  const results: VenueLatencySample[] = [];
  for (let index = 0; index < samples; index += 1) {
    results.push(await measureOnce(endpoint));
  }
  return results;
}

async function measureOnce(endpoint: string): Promise<VenueLatencySample> {
  const startedAt = nowMs();
  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        "User-Agent": "ArbX-Ray latency race",
      },
      signal: AbortSignal.timeout(5_000),
    });
    await response.arrayBuffer();
    return {
      ok: response.ok,
      status: response.status,
      ms: nowMs() - startedAt,
      error: response.ok ? undefined : `${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      ok: false,
      ms: nowMs() - startedAt,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

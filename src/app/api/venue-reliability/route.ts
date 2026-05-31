import { NextResponse } from "next/server";
import { buildVenueLatencyRace, type VenueLatencyProbe, type VenueLatencySample } from "@/lib/market/venue-latency";
import {
  buildVenueReliabilityOracle,
  parseStatusPageStatus,
  type ReliabilityVenueId,
} from "@/lib/market/venue-reliability";

const statusSources: Array<{ venue: ReliabilityVenueId; label: string; url: string }> = [
  { venue: "coinbase", label: "Coinbase", url: "https://status.coinbase.com/api/v2/status.json" },
  { venue: "kraken", label: "Kraken", url: "https://status.kraken.com/api/v2/status.json" },
  { venue: "gemini", label: "Gemini", url: "https://status.gemini.com/api/v2/status.json" },
  { venue: "bitstamp", label: "Bitstamp", url: "https://status.bitstamp.net/api/v2/status.json" },
  { venue: "bitfinex", label: "Bitfinex", url: "https://bitfinex.statuspage.io/api/v2/status.json" },
  { venue: "okx", label: "OKX", url: "https://status.okx.com/api/v2/status.json" },
];

const latencySources = [
  { venue: "coinbase", label: "Coinbase", endpoint: "https://api.coinbase.com/v2/time" },
  { venue: "kraken", label: "Kraken", endpoint: "https://api.kraken.com/0/public/Time" },
  { venue: "gemini", label: "Gemini", endpoint: "https://api.gemini.com/v1/pubticker/btcusd" },
  { venue: "bitstamp", label: "Bitstamp", endpoint: "https://www.bitstamp.net/api/v2/ticker/btcusd/" },
  { venue: "bitfinex", label: "Bitfinex", endpoint: "https://api-pub.bitfinex.com/v2/platform/status" },
  { venue: "okx", label: "OKX", endpoint: "https://www.okx.com/api/v5/public/time" },
];

export async function GET() {
  const errors: string[] = [];
  const fetchedAt = Date.now();
  const [statusPayloads, latency] = await Promise.all([
    Promise.all(statusSources.map((source) => fetchJson(source.url, errors))),
    buildReliabilityLatency(),
  ]);
  const statuses = statusSources
    .map((source, index) => parseStatusPageStatus(source.venue, source.label, source.url, statusPayloads[index], fetchedAt))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return NextResponse.json(
    buildVenueReliabilityOracle({
      statuses,
      latency,
      observedAt: Date.now(),
      errors,
    }),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function buildReliabilityLatency() {
  const measured = await Promise.all(
    latencySources.map(async (probe): Promise<VenueLatencyProbe> => ({
      ...probe,
      samples: [await measureOnce(probe.endpoint), await measureOnce(probe.endpoint)],
    })),
  );
  return buildVenueLatencyRace({
    probes: measured,
    latencyBudgetMs: 900,
    notionalUsd: 50_000,
    realizedVolBpsPerSecond: 8,
    generatedAt: Date.now(),
  });
}

async function fetchJson(url: string, errors: string[]): Promise<unknown> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "ArbX-Ray venue reliability oracle",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json() as Promise<unknown>;
  } catch (error) {
    errors.push(`${url}: ${error instanceof Error ? error.message : "unknown error"}`);
    return undefined;
  }
}

async function measureOnce(endpoint: string): Promise<VenueLatencySample> {
  const startedAt = nowMs();
  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        "User-Agent": "ArbX-Ray venue reliability latency",
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

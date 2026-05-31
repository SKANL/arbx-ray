import { NextResponse } from "next/server";
import { buildVenueIntelligence } from "@/lib/market/venue-intelligence";

export async function GET() {
  const errors: string[] = [];
  const coinGeckoTickers = await fetchJson(
    "https://api.coingecko.com/api/v3/coins/bitcoin/tickers?include_exchange_logo=false&depth=true&order=volume_desc&page=1",
    errors,
  );

  return NextResponse.json(buildVenueIntelligence({ coinGeckoTickers, errors }), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function fetchJson(url: string, errors: string[]): Promise<unknown> {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json() as Promise<unknown>;
  } catch (error) {
    errors.push(`${url}: ${error instanceof Error ? error.message : "unknown error"}`);
    return undefined;
  }
}

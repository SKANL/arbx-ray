import { NextResponse } from "next/server";
import { buildTriangularLab, parseCoinbaseBook, type TriangularPair } from "@/lib/market/triangular";

const pairs: TriangularPair[] = ["BTC-USD", "ETH-USD", "ETH-BTC"];

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [btcUsdPayload, ethUsdPayload, ethBtcPayload] = await Promise.all(
    pairs.map((pair) =>
      fetchJson(`https://api.exchange.coinbase.com/products/${pair}/book?level=2`, errors),
    ),
  );

  return NextResponse.json(
    buildTriangularLab({
      btcUsd: parseCoinbaseBook("BTC-USD", btcUsdPayload, receivedAt),
      ethUsd: parseCoinbaseBook("ETH-USD", ethUsdPayload, receivedAt),
      ethBtc: parseCoinbaseBook("ETH-BTC", ethBtcPayload, receivedAt),
      errors,
    }),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
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

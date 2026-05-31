import { NextResponse } from "next/server";
import {
  buildHistoricalReplay,
  parseCoinbaseCandles,
  parseKrakenOhlcCandles,
} from "@/lib/market/historical";

export async function GET() {
  const errors: string[] = [];
  const [krakenPayload, coinbasePayload] = await Promise.all([
    fetchJson("https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1", errors),
    fetchJson("https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60", errors),
  ]);

  const replay = buildHistoricalReplay({
    kraken: parseKrakenOhlcCandles(krakenPayload),
    coinbase: parseCoinbaseCandles(coinbasePayload),
    errors,
  });

  return NextResponse.json(replay, {
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

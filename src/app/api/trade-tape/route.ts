import { NextResponse } from "next/server";
import {
  buildTradeTapeToxicity,
  parseCoinbaseTrades,
  parseKrakenTrades,
} from "@/lib/market/trade-tape";

const sources = {
  coinbase: "https://api.exchange.coinbase.com/products/BTC-USD/trades?limit=100",
  kraken: "https://api.kraken.com/0/public/Trades?pair=XBTUSD",
};

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [coinbase, kraken] = await Promise.all([
    fetchJson(sources.coinbase, errors),
    fetchJson(sources.kraken, errors),
  ]);

  return NextResponse.json(
    buildTradeTapeToxicity({
      tradesByVenue: {
        coinbase: parseCoinbaseTrades(coinbase, receivedAt),
        kraken: parseKrakenTrades(kraken, receivedAt),
      },
      observedAt: Date.now(),
      sources: Object.values(sources),
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
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "ArbX-Ray simulation lab",
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

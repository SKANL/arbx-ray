import { NextResponse } from "next/server";
import {
  buildUsdtBasisOracle,
  parseBitstampUsdtTicker,
  parseCoinbaseUsdtTicker,
  parseCoinGeckoTetherPrice,
  parseKrakenUsdtTicker,
} from "@/lib/market/usdt-basis";

const sources = {
  coinbase: "https://api.exchange.coinbase.com/products/USDT-USD/ticker",
  kraken: "https://api.kraken.com/0/public/Ticker?pair=USDTUSD",
  bitstamp: "https://www.bitstamp.net/api/v2/ticker/usdtusd/",
  coingecko:
    "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd&include_24hr_vol=true&include_last_updated_at=true",
};

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [coinbase, kraken, bitstamp, coingecko] = await Promise.all([
    fetchJson(sources.coinbase, errors),
    fetchJson(sources.kraken, errors),
    fetchJson(sources.bitstamp, errors),
    fetchJson(sources.coingecko, errors),
  ]);

  return NextResponse.json(
    buildUsdtBasisOracle({
      tickers: [
        parseCoinbaseUsdtTicker(coinbase, receivedAt),
        parseKrakenUsdtTicker(kraken, receivedAt),
        parseBitstampUsdtTicker(bitstamp, receivedAt),
        parseCoinGeckoTetherPrice(coingecko, receivedAt),
      ],
      generatedAt: Date.now(),
      staleMs: 90_000,
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
        "User-Agent": "ArbX-Ray USDT basis oracle",
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

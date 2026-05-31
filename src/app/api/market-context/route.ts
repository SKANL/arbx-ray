import { NextResponse } from "next/server";
import { buildMarketContext } from "@/lib/market/context";

export async function GET() {
  const errors: string[] = [];
  const [klines, krakenOhlc, ticker24h, mempoolFees, coingeckoMarkets, alternativeFearGreed] = await Promise.all([
    fetchJson("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=90", errors),
    fetchJson("https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1", errors),
    fetchJson("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", errors),
    fetchJson("https://mempool.space/api/v1/fees/recommended", errors),
    fetchJson(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin&sparkline=false&price_change_percentage=24h",
      errors,
    ),
    fetchJson("https://api.alternative.me/fng/?limit=1", errors),
  ]);

  return NextResponse.json(
    buildMarketContext({
      klines,
      krakenOhlc,
      ticker24h,
      mempoolFees,
      coingeckoMarkets,
      alternativeFearGreed,
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

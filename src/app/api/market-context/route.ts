import { NextResponse } from "next/server";
import { buildMarketContext } from "@/lib/market/context";
import { fetchPublicJson } from "@/lib/server/public-fetch";

export async function GET() {
  const errors: string[] = [];
  const [klines, krakenOhlc, ticker24h, mempoolFees, coingeckoMarkets, alternativeFearGreed] = await Promise.all([
    fetchPublicJson("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=90", errors),
    fetchPublicJson("https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1", errors),
    fetchPublicJson("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", errors),
    fetchPublicJson("https://mempool.space/api/v1/fees/recommended", errors),
    fetchPublicJson(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin&sparkline=false&price_change_percentage=24h",
      errors,
    ),
    fetchPublicJson("https://api.alternative.me/fng/?limit=1", errors),
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

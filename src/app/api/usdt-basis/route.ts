import { NextResponse } from "next/server";
import {
  buildUsdtBasisOracle,
  parseBitstampUsdtTicker,
  parseCoinbaseUsdtTicker,
  parseCoinGeckoTetherPrice,
  parseKrakenUsdtTicker,
} from "@/lib/market/usdt-basis";
import { fetchPublicJson } from "@/lib/server/public-fetch";

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
    fetchPublicJson(sources.coinbase, errors, { userAgent: "ArbX-Ray USDT basis oracle" }),
    fetchPublicJson(sources.kraken, errors, { userAgent: "ArbX-Ray USDT basis oracle" }),
    fetchPublicJson(sources.bitstamp, errors, { userAgent: "ArbX-Ray USDT basis oracle" }),
    fetchPublicJson(sources.coingecko, errors, { userAgent: "ArbX-Ray USDT basis oracle" }),
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

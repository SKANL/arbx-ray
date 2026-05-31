import { NextResponse } from "next/server";
import {
  buildPriceConsensusOracle,
  parseBinanceTicker,
  parseBitsoTicker,
  parseBitstampTicker,
  parseCoinbaseTicker,
  parseKrakenTicker,
} from "@/lib/market/price-consensus";
import { fetchPublicJson } from "@/lib/server/public-fetch";

const sources = {
  coinbase: "https://api.exchange.coinbase.com/products/BTC-USD/ticker",
  kraken: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
  binance: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
  bitstamp: "https://www.bitstamp.net/api/v2/ticker/btcusd/",
  bitsoBtcMxn: "https://api.bitso.com/v3/ticker/?book=btc_mxn",
  bitsoUsdMxn: "https://api.bitso.com/v3/ticker/?book=usd_mxn",
};

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [coinbase, kraken, binance, bitstamp, bitsoBtcMxn, bitsoUsdMxn] = await Promise.all([
    fetchPublicJson(sources.coinbase, errors, { userAgent: "ArbX-Ray price consensus" }),
    fetchPublicJson(sources.kraken, errors, { userAgent: "ArbX-Ray price consensus" }),
    fetchPublicJson(sources.binance, errors, { userAgent: "ArbX-Ray price consensus" }),
    fetchPublicJson(sources.bitstamp, errors, { userAgent: "ArbX-Ray price consensus" }),
    fetchPublicJson(sources.bitsoBtcMxn, errors, { userAgent: "ArbX-Ray price consensus" }),
    fetchPublicJson(sources.bitsoUsdMxn, errors, { userAgent: "ArbX-Ray price consensus" }),
  ]);
  const usdMxnRate = parseBitsoUsdMxnRate(bitsoUsdMxn);
  if (!usdMxnRate) errors.push("Bitso USD/MXN ticker unavailable for MXN conversion");

  return NextResponse.json(
    buildPriceConsensusOracle({
      tickers: [
        parseCoinbaseTicker(coinbase, receivedAt),
        parseKrakenTicker(kraken, receivedAt),
        parseBinanceTicker(binance, receivedAt),
        parseBitstampTicker(bitstamp, receivedAt),
        parseBitsoTicker(bitsoBtcMxn, usdMxnRate, receivedAt),
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

function parseBitsoUsdMxnRate(payload: unknown): number {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.payload)) return 0;
  const last = Number(payload.payload.last);
  return Number.isFinite(last) && last > 0 ? last : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

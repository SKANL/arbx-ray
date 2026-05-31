import { NextResponse } from "next/server";
import {
  buildPriceConsensusOracle,
  parseBinanceTicker,
  parseBitsoTicker,
  parseBitstampTicker,
  parseCoinbaseTicker,
  parseKrakenTicker,
} from "@/lib/market/price-consensus";

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
    fetchJson(sources.coinbase, errors),
    fetchJson(sources.kraken, errors),
    fetchJson(sources.binance, errors),
    fetchJson(sources.bitstamp, errors),
    fetchJson(sources.bitsoBtcMxn, errors),
    fetchJson(sources.bitsoUsdMxn, errors),
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

async function fetchJson(url: string, errors: string[]): Promise<unknown> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "ArbX-Ray price consensus",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

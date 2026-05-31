import { NextResponse } from "next/server";
import {
  buildLeadLagOracle,
  parseBinanceLeadLagTrades,
  parseBitfinexLeadLagTrades,
  parseBitstampLeadLagTrades,
  parseCoinbaseLeadLagTrades,
  parseGeminiLeadLagTrades,
  parseKrakenLeadLagTrades,
} from "@/lib/market/lead-lag";

const sources = {
  coinbase: "https://api.exchange.coinbase.com/products/BTC-USD/trades?limit=300",
  kraken: "https://api.kraken.com/0/public/Trades?pair=XBTUSD",
  bitstamp: "https://www.bitstamp.net/api/v2/transactions/btcusd/?time=hour",
  gemini: "https://api.gemini.com/v1/trades/btcusd?limit_trades=500",
  bitfinex: "https://api-pub.bitfinex.com/v2/trades/tBTCUSD/hist?limit=500&sort=-1",
  binance: "https://api.binance.com/api/v3/aggTrades?symbol=BTCUSDT&limit=500",
};

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [coinbase, kraken, bitstamp, gemini, bitfinex, binance] = await Promise.all([
    fetchJson(sources.coinbase, errors),
    fetchJson(sources.kraken, errors),
    fetchJson(sources.bitstamp, errors),
    fetchJson(sources.gemini, errors),
    fetchJson(sources.bitfinex, errors),
    fetchJson(sources.binance, errors),
  ]);

  return NextResponse.json(
    buildLeadLagOracle({
      tradesByVenue: {
        coinbase: parseCoinbaseLeadLagTrades(coinbase, receivedAt),
        kraken: parseKrakenLeadLagTrades(kraken, receivedAt),
        bitstamp: parseBitstampLeadLagTrades(bitstamp, receivedAt),
        gemini: parseGeminiLeadLagTrades(gemini, receivedAt),
        bitfinex: parseBitfinexLeadLagTrades(bitfinex, receivedAt),
        binance: parseBinanceLeadLagTrades(binance, receivedAt),
      },
      observedAt: Date.now(),
      bucketMs: 10_000,
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
        "User-Agent": "ArbX-Ray lead-lag oracle",
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

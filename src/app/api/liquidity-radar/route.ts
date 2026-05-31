import { NextResponse } from "next/server";
import {
  buildLiquidityRadar,
  parseBitfinexBook,
  parseBitstampBook,
  parseCoinbaseRestBook,
  parseGeminiBook,
  parseKrakenDepthBook,
  parseKuCoinBook,
  parseOkxBook,
} from "@/lib/market/liquidity-radar";

const sources = {
  coinbase: "https://api.exchange.coinbase.com/products/BTC-USD/book?level=2",
  kraken: "https://api.kraken.com/0/public/Depth?pair=XBTUSD&count=50",
  bitstamp: "https://www.bitstamp.net/api/v2/order_book/btcusd/",
  bitfinex: "https://api-pub.bitfinex.com/v2/book/tBTCUSD/P0?len=25",
  okx: "https://www.okx.com/api/v5/market/books?instId=BTC-USDT&sz=50",
  gemini: "https://api.gemini.com/v1/book/btcusd?limit_bids=20&limit_asks=20",
  kucoin: "https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol=BTC-USDT",
};

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [coinbase, kraken, bitstamp, bitfinex, okx, gemini, kucoin] = await Promise.all([
    fetchJson(sources.coinbase, errors),
    fetchJson(sources.kraken, errors),
    fetchJson(sources.bitstamp, errors),
    fetchJson(sources.bitfinex, errors),
    fetchJson(sources.okx, errors),
    fetchJson(sources.gemini, errors),
    fetchJson(sources.kucoin, errors),
  ]);

  return NextResponse.json(
    buildLiquidityRadar({
      books: [
        parseCoinbaseRestBook(coinbase, receivedAt),
        parseKrakenDepthBook(kraken, receivedAt),
        parseBitstampBook(bitstamp, receivedAt),
        parseBitfinexBook(bitfinex, receivedAt),
        parseOkxBook(okx, receivedAt),
        parseGeminiBook(gemini, receivedAt),
        parseKuCoinBook(kucoin, receivedAt),
      ],
      targetSizeBtc: 0.35,
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

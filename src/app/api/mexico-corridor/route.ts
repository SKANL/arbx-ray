import { NextResponse } from "next/server";
import {
  buildMexicoCorridorLab,
  parseBitsoOrderBook,
  parseCoinbaseUsdBook,
} from "@/lib/market/mexico-corridor";

const sources = {
  coinbaseBtcUsd: "https://api.exchange.coinbase.com/products/BTC-USD/book?level=2",
  bitsoBtcMxn: "https://api.bitso.com/v3/order_book/?book=btc_mxn",
  bitsoUsdMxn: "https://api.bitso.com/v3/order_book/?book=usd_mxn",
};

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [coinbaseBtcUsd, bitsoBtcMxn, bitsoUsdMxn] = await Promise.all([
    fetchJson(sources.coinbaseBtcUsd, errors),
    fetchJson(sources.bitsoBtcMxn, errors),
    fetchJson(sources.bitsoUsdMxn, errors),
  ]);

  return NextResponse.json(
    buildMexicoCorridorLab({
      coinbaseBtcUsd: parseCoinbaseUsdBook(coinbaseBtcUsd, receivedAt),
      bitsoBtcMxn: parseBitsoOrderBook("btc_mxn", bitsoBtcMxn, receivedAt),
      bitsoUsdMxn: parseBitsoOrderBook("usd_mxn", bitsoUsdMxn, receivedAt),
      targetSizeBtc: 0.25,
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

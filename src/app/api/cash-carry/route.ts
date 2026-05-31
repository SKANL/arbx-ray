import { NextResponse } from "next/server";
import {
  buildCashCarryLab,
  parseBitmexCarryPerp,
  parseDeribitCarryPerp,
  parseOkxCarryPerp,
  type CarrySpotVenue,
} from "@/lib/market/cash-carry";
import {
  parseBinanceTicker,
  parseBitstampTicker,
  parseCoinbaseTicker,
  parseKrakenTicker,
  type ConsensusTicker,
} from "@/lib/market/price-consensus";

const sources = {
  coinbase: "https://api.exchange.coinbase.com/products/BTC-USD/ticker",
  kraken: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
  binance: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
  bitstamp: "https://www.bitstamp.net/api/v2/ticker/btcusd/",
  okxFunding: "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP",
  okxTicker: "https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT-SWAP",
  deribitTicker: "https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL",
  bitmexInstrument: "https://www.bitmex.com/api/v1/instrument?symbol=XBTUSDT",
};

const spotFeesBps: Record<string, number> = {
  coinbase: 40,
  kraken: 26,
  binance: 10,
  bitstamp: 30,
};

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [
    coinbase,
    kraken,
    binance,
    bitstamp,
    okxFunding,
    okxTicker,
    deribitTicker,
    bitmexInstrument,
  ] = await Promise.all([
    fetchJson(sources.coinbase, errors),
    fetchJson(sources.kraken, errors),
    fetchJson(sources.binance, errors),
    fetchJson(sources.bitstamp, errors),
    fetchJson(sources.okxFunding, errors),
    fetchJson(sources.okxTicker, errors),
    fetchJson(sources.deribitTicker, errors),
    fetchJson(sources.bitmexInstrument, errors),
  ]);

  return NextResponse.json(
    buildCashCarryLab({
      spots: [
        toCarrySpot(parseCoinbaseTicker(coinbase, receivedAt)),
        toCarrySpot(parseKrakenTicker(kraken, receivedAt)),
        toCarrySpot(parseBinanceTicker(binance, receivedAt)),
        toCarrySpot(parseBitstampTicker(bitstamp, receivedAt)),
      ],
      perps: [
        parseOkxCarryPerp(okxFunding, okxTicker, receivedAt),
        parseDeribitCarryPerp(deribitTicker, receivedAt),
        parseBitmexCarryPerp(bitmexInstrument, receivedAt),
      ],
      generatedAt: Date.now(),
      holdingDays: 7,
      notionalUsd: 25_000,
      errors,
    }),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function toCarrySpot(ticker?: ConsensusTicker): CarrySpotVenue | undefined {
  if (!ticker) return undefined;
  return {
    venue: ticker.venue,
    label: ticker.label,
    pair: ticker.pair,
    priceUsd: ticker.priceUsd,
    takerFeeBps: spotFeesBps[ticker.venue] ?? 35,
    receivedAt: ticker.exchangeTimestamp ?? ticker.receivedAt,
    source: ticker.source,
  };
}

async function fetchJson(url: string, errors: string[]): Promise<unknown> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "ArbX-Ray cash carry lab",
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

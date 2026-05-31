import { NextResponse } from "next/server";
import {
  buildTradeTapeToxicity,
  parseCoinbaseTrades,
  parseKrakenTrades,
} from "@/lib/market/trade-tape";
import { fetchPublicJson } from "@/lib/server/public-fetch";

const sources = {
  coinbase: "https://api.exchange.coinbase.com/products/BTC-USD/trades?limit=100",
  kraken: "https://api.kraken.com/0/public/Trades?pair=XBTUSD",
};

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [coinbase, kraken] = await Promise.all([
    fetchPublicJson(sources.coinbase, errors, { userAgent: "ArbX-Ray simulation lab" }),
    fetchPublicJson(sources.kraken, errors, { userAgent: "ArbX-Ray simulation lab" }),
  ]);

  return NextResponse.json(
    buildTradeTapeToxicity({
      tradesByVenue: {
        coinbase: parseCoinbaseTrades(coinbase, receivedAt),
        kraken: parseKrakenTrades(kraken, receivedAt),
      },
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

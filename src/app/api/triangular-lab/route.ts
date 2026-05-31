import { NextResponse } from "next/server";
import { buildTriangularLab, parseCoinbaseBook, type TriangularPair } from "@/lib/market/triangular";
import { fetchPublicJson } from "@/lib/server/public-fetch";

const pairs: TriangularPair[] = ["BTC-USD", "ETH-USD", "ETH-BTC"];

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [btcUsdPayload, ethUsdPayload, ethBtcPayload] = await Promise.all(
    pairs.map((pair) =>
      fetchPublicJson(`https://api.exchange.coinbase.com/products/${pair}/book?level=2`, errors),
    ),
  );

  return NextResponse.json(
    buildTriangularLab({
      btcUsd: parseCoinbaseBook("BTC-USD", btcUsdPayload, receivedAt),
      ethUsd: parseCoinbaseBook("ETH-USD", ethUsdPayload, receivedAt),
      ethBtc: parseCoinbaseBook("ETH-BTC", ethBtcPayload, receivedAt),
      errors,
    }),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

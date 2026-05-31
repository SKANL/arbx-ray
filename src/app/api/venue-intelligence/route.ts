import { NextResponse } from "next/server";
import { buildVenueIntelligence } from "@/lib/market/venue-intelligence";
import { fetchPublicJson } from "@/lib/server/public-fetch";

export async function GET() {
  const errors: string[] = [];
  const coinGeckoTickers = await fetchPublicJson(
    "https://api.coingecko.com/api/v3/coins/bitcoin/tickers?include_exchange_logo=false&depth=true&order=volume_desc&page=1",
    errors,
  );

  return NextResponse.json(buildVenueIntelligence({ coinGeckoTickers, errors }), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch("https://www.bitstamp.net/api/v2/order_book/btcusd/", {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Bitstamp order book snapshot failed", status: response.status },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as unknown;
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

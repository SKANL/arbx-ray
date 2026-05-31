import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch("https://api.exchange.coinbase.com/products/BTC-USD/book?level=2", {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Coinbase order book snapshot failed", status: response.status },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return NextResponse.json(
    {
      ...payload,
      type: "snapshot",
      product_id: "BTC-USD",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

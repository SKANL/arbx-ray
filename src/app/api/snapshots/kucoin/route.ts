import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch("https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol=BTC-USDT", {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "KuCoin order book snapshot failed", status: response.status },
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

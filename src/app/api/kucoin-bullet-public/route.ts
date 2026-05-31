import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch("https://api.kucoin.com/api/v1/bullet-public", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "KuCoin public WebSocket token failed", status: response.status },
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

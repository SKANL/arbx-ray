import { NextResponse } from "next/server";
import {
  buildOptionsIvOracle,
  parseDeribitIndexPrice,
  parseDeribitOptionSummaries,
} from "@/lib/market/options-iv";

const sources = {
  deribitOptions: "https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option",
  deribitIndex: "https://www.deribit.com/api/v2/public/get_index_price?index_name=btc_usd",
};

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [optionsPayload, indexPayload] = await Promise.all([
    fetchJson(sources.deribitOptions, errors),
    fetchJson(sources.deribitIndex, errors),
  ]);

  return NextResponse.json(
    buildOptionsIvOracle({
      quotes: parseDeribitOptionSummaries(optionsPayload, receivedAt),
      indexPriceUsd: parseDeribitIndexPrice(indexPayload),
      generatedAt: Date.now(),
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
        "User-Agent": "ArbX-Ray options IV oracle",
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

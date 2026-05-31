import { NextResponse } from "next/server";
import {
  buildDerivativesPressureOracle,
  parseBitmexInstrument,
  parseDeribitTicker,
  parseOkxFundingRate,
  parseOkxSwapTicker,
} from "@/lib/market/derivatives-pressure";

const sources = {
  okxFunding: "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP",
  okxTicker: "https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT-SWAP",
  deribitTicker: "https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL",
  bitmexInstrument: "https://www.bitmex.com/api/v1/instrument?symbol=XBTUSDT",
};

export async function GET() {
  const errors: string[] = [];
  const receivedAt = Date.now();
  const [okxFundingPayload, okxTickerPayload, deribitTickerPayload, bitmexInstrumentPayload] = await Promise.all([
    fetchJson(sources.okxFunding, errors),
    fetchJson(sources.okxTicker, errors),
    fetchJson(sources.deribitTicker, errors),
    fetchJson(sources.bitmexInstrument, errors),
  ]);

  const okxFunding = parseOkxFundingRate(okxFundingPayload, receivedAt);
  const okxTicker = parseOkxSwapTicker(okxTickerPayload, receivedAt);

  return NextResponse.json(
    buildDerivativesPressureOracle({
      venues: [
        okxFunding && okxTicker
          ? {
              ...okxFunding,
              notionalVolumeUsd24h: okxTicker.notionalVolumeUsd24h,
              exchangeTimestamp: okxTicker.exchangeTimestamp ?? okxFunding.exchangeTimestamp,
            }
          : okxFunding,
        parseDeribitTicker(deribitTickerPayload, receivedAt),
        parseBitmexInstrument(bitmexInstrumentPayload, receivedAt),
      ],
      generatedAt: Date.now(),
      staleMs: 120_000,
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
        "User-Agent": "ArbX-Ray derivatives pressure oracle",
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

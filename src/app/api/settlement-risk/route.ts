import { NextResponse } from "next/server";
import { buildSettlementRiskOracle, parseMempoolBlocks, parseRecommendedFees } from "@/lib/market/settlement-risk";
import { fetchPublicJson } from "@/lib/server/public-fetch";

const sources = {
  fees: "https://mempool.space/api/v1/fees/recommended",
  blocks: "https://mempool.space/api/v1/fees/mempool-blocks",
  fallbackFees: "https://bitcoinsapi.com/api/v1/fees/recommended",
  fallbackBlocks: "https://bitcoinsapi.com/api/v1/fees/mempool-blocks",
  coingecko: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
};

export async function GET() {
  const errors: string[] = [];
  const [feesPayload, blocksPayload, coingeckoPayload] = await Promise.all([
    fetchFirstJson([sources.fees, sources.fallbackFees], errors),
    fetchFirstJson([sources.blocks, sources.fallbackBlocks], errors),
    fetchPublicJson(sources.coingecko, errors, { userAgent: "ArbX-Ray settlement risk oracle" }),
  ]);
  const btcUsd = parseCoinGeckoBtcUsd(coingeckoPayload) || 70_000;

  return NextResponse.json(
    buildSettlementRiskOracle({
      fees: parseRecommendedFees(feesPayload),
      blocks: parseMempoolBlocks(blocksPayload),
      btcUsd,
      txVbytes: 180,
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

async function fetchFirstJson(urls: string[], errors: string[]): Promise<unknown> {
  for (const url of urls) {
    const payload = await fetchPublicJson(url, errors, { userAgent: "ArbX-Ray settlement risk oracle" });
    if (payload !== undefined) return payload;
  }
  return undefined;
}

function parseCoinGeckoBtcUsd(payload: unknown): number {
  if (!isRecord(payload) || !isRecord(payload.bitcoin)) return 0;
  const price = Number(payload.bitcoin.usd);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

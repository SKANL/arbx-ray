import { NextResponse } from "next/server";
import { buildBackendHealth } from "@/lib/market/backend-manifest";

export async function GET() {
  return NextResponse.json(buildBackendHealth(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { buildBackendManifest } from "@/lib/market/backend-manifest";

export async function GET() {
  return NextResponse.json(buildBackendManifest(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
